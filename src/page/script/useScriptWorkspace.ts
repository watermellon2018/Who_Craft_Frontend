import axios from 'axios';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {characterApi} from '../../modules/character-studio/api/characterApi';
import {scriptApi} from './api';
import type {ScenePlacement} from './sceneStructure';
import type {
  CompactCharacter,
  MissingScriptCharacter,
  Scene,
  ScriptProject,
  ScriptStats,
  WorkspaceConflict,
  WorkspaceMode,
} from './types';

const EMPTY_STATS: ScriptStats = {sceneCount: 0, totalDurationSeconds: 0, acts: []};
export const SCRIPT_AUTO_SAVE_DELAY_MS = 800;

const calculateStats = (scenes: Scene[]): ScriptStats => ({
  sceneCount: scenes.length,
  totalDurationSeconds: scenes.reduce((total, scene) => total + scene.durationSeconds, 0),
  acts: [1, 2, 3].map((act) => {
    const actScenes = scenes.filter((scene) => scene.act === act);
    return {
      act,
      sceneCount: actScenes.length,
      durationSeconds: actScenes.reduce((total, scene) => total + scene.durationSeconds, 0),
    };
  }),
});

const describeApiError = (error: unknown) => {
  if (!axios.isAxiosError(error)) return 'Не удалось загрузить рабочее пространство. Повторите попытку.';
  if (error.response?.status === 401) return 'Сессия завершена. Войдите снова.';
  if (error.response?.status === 403) return 'У вас нет доступа к этому проекту.';
  if (error.response?.status === 404) return 'Проект не найден или был удалён.';
  return 'Не удалось загрузить рабочее пространство. Повторите попытку.';
};

export function useScriptWorkspace(projectId: string) {
  const {t} = useTranslation();
  const ownerKey = projectId;
  const [mode, setMode] = useState<WorkspaceMode>('screenplay');
  const [project, setProject] = useState<ScriptProject | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characters, setCharacters] = useState<CompactCharacter[]>([]);
  const [missingCharacters, setMissingCharacters] = useState<MissingScriptCharacter[]>([]);
  const [missingCharactersError, setMissingCharactersError] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [characterSceneFilter, setCharacterSceneFilter] = useState<string | null>(null);
  const [dirtySceneIds, setDirtySceneIds] = useState<number[]>([]);
  const [savingSceneIds, setSavingSceneIds] = useState<number[]>([]);
  const [reordering, setReordering] = useState(false);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<WorkspaceConflict | null>(null);
  const [stateOwnerKey, setStateOwnerKey] = useState(ownerKey);
  const [dataOwnerKey, setDataOwnerKey] = useState<string | null>(null);
  const ownerKeyRef = useRef(ownerKey);
  const loadedOwnerKeyRef = useRef<string | null>(null);
  const loadRequestRef = useRef(0);
  const missingCharactersRequestRef = useRef(0);
  const scenesRef = useRef<Scene[]>([]);
  const dirtyRef = useRef(new Set<number>());
  const editRevisionRef = useRef(new Map<number, number>());
  const savePromisesRef = useRef(new Map<string, Promise<boolean>>());
  const deletingSceneIdsRef = useRef(new Set<number>());
  const reorderingRef = useRef(false);
  const reorderPromiseRef = useRef<Promise<boolean> | null>(null);

  if (ownerKeyRef.current !== ownerKey) {
    ownerKeyRef.current = ownerKey;
    loadedOwnerKeyRef.current = null;
    loadRequestRef.current += 1;
    missingCharactersRequestRef.current += 1;
    scenesRef.current = [];
    dirtyRef.current.clear();
    editRevisionRef.current.clear();
    savePromisesRef.current.clear();
    deletingSceneIdsRef.current.clear();
    reorderingRef.current = false;
    reorderPromiseRef.current = null;
  }

  const replaceScenes = useCallback((nextScenes: Scene[]) => {
    const sorted = [...nextScenes].sort((left, right) => left.order - right.order);
    scenesRef.current = sorted;
    setScenes(sorted);
  }, []);

  const loadWorkspace = useCallback(async () => {
    const requestedOwnerKey = ownerKey;
    const requestToken = loadRequestRef.current + 1;
    loadRequestRef.current = requestToken;
    const missingCharactersRequestToken = missingCharactersRequestRef.current + 1;
    missingCharactersRequestRef.current = missingCharactersRequestToken;
    loadedOwnerKeyRef.current = null;
    scenesRef.current = [];
    dirtyRef.current.clear();
    editRevisionRef.current.clear();
    savePromisesRef.current.clear();
    deletingSceneIdsRef.current.clear();
    reorderingRef.current = false;
    reorderPromiseRef.current = null;
    setStateOwnerKey(requestedOwnerKey);
    setDataOwnerKey(null);
    setProject(null);
    setScenes([]);
    setCharacters([]);
    setMissingCharacters([]);
    setMissingCharactersError(null);
    setSelectedSceneId(null);
    setSelectedCharacterId(null);
    setCharacterSceneFilter(null);
    setDirtySceneIds([]);
    setSavingSceneIds([]);
    setReordering(false);
    setMode('screenplay');
    setError(null);
    setConflict(null);
    setSaveError(null);
    setLoading(Boolean(requestedOwnerKey));
    if (!requestedOwnerKey) return;

    const isCurrentRequest = () => (
      ownerKeyRef.current === requestedOwnerKey
      && loadRequestRef.current === requestToken
    );

    void scriptApi.getMissingCharacters(requestedOwnerKey)
      .then((items) => {
        if (
          !isCurrentRequest()
          || missingCharactersRequestRef.current !== missingCharactersRequestToken
        ) return;
        setMissingCharacters(items);
        setMissingCharactersError(null);
      })
      .catch(() => {
        if (
          isCurrentRequest()
          && missingCharactersRequestRef.current === missingCharactersRequestToken
        ) {
          setMissingCharactersError(
            t('videoPreparation.scriptNotice.initialError', {
              defaultValue: 'Не удалось проверить персонажей сценария. Повторите попытку.',
            }),
          );
        }
      });

    try {
      const [workspace, compactCharacters] = await Promise.all([
        scriptApi.getWorkspace(requestedOwnerKey),
        scriptApi.getCharacters(requestedOwnerKey),
      ]);
      if (!isCurrentRequest()) return;

      setProject(workspace.project);
      replaceScenes(workspace.scenes);
      setCharacters(compactCharacters);
      setSelectedSceneId(workspace.scenes[0]?.id ?? null);
      setSelectedCharacterId(compactCharacters[0]?.id ?? null);
      loadedOwnerKeyRef.current = requestedOwnerKey;
      setDataOwnerKey(requestedOwnerKey);
    } catch (loadError) {
      if (!isCurrentRequest()) return;
      setError(describeApiError(loadError));
    } finally {
      if (isCurrentRequest()) setLoading(false);
    }
  }, [ownerKey, replaceScenes, t]);

  useEffect(() => {
    void loadWorkspace();
    return () => {
      loadRequestRef.current += 1;
      missingCharactersRequestRef.current += 1;
    };
  }, [loadWorkspace]);

  const ownsLoadedWorkspace = useCallback((requestedOwnerKey: string) => (
    ownerKeyRef.current === requestedOwnerKey
    && loadedOwnerKeyRef.current === requestedOwnerKey
  ), []);

  const refreshMissingCharacters = useCallback(async () => {
    const requestedOwnerKey = ownerKey;
    if (!requestedOwnerKey || !ownsLoadedWorkspace(requestedOwnerKey)) return false;
    const requestToken = missingCharactersRequestRef.current + 1;
    missingCharactersRequestRef.current = requestToken;
    try {
      const items = await scriptApi.getMissingCharacters(requestedOwnerKey);
      if (
        !ownsLoadedWorkspace(requestedOwnerKey)
        || missingCharactersRequestRef.current !== requestToken
      ) return false;
      setMissingCharacters(items);
      setMissingCharactersError(null);
      return true;
    } catch {
      if (
        ownsLoadedWorkspace(requestedOwnerKey)
        && missingCharactersRequestRef.current === requestToken
      ) {
        setMissingCharactersError(
          t('videoPreparation.scriptNotice.refreshError', {
            defaultValue: 'Не удалось обновить список недостающих персонажей. Повторите попытку.',
          }),
        );
      }
      return false;
    }
  }, [ownerKey, ownsLoadedWorkspace, t]);

  const ownsVisibleData = stateOwnerKey === ownerKey && dataOwnerKey === ownerKey;
  const visibleProject = ownsVisibleData ? project : null;
  const visibleScenes = useMemo(() => ownsVisibleData ? scenes : [], [ownsVisibleData, scenes]);
  const visibleCharacters = useMemo(
    () => ownsVisibleData ? characters : [],
    [characters, ownsVisibleData],
  );
  const visibleMissingCharacters = useMemo(
    () => ownsVisibleData ? missingCharacters : [],
    [missingCharacters, ownsVisibleData],
  );
  const visibleSelectedSceneId = ownsVisibleData ? selectedSceneId : null;
  const visibleSelectedCharacterId = ownsVisibleData ? selectedCharacterId : null;
  const visibleCharacterSceneFilter = ownsVisibleData ? characterSceneFilter : null;

  const selectedScene = useMemo(
    () => visibleScenes.find((scene) => scene.id === visibleSelectedSceneId) ?? null,
    [visibleScenes, visibleSelectedSceneId],
  );
  const selectedCharacter = useMemo(
    () => visibleCharacters.find((character) => character.id === visibleSelectedCharacterId) ?? null,
    [visibleCharacters, visibleSelectedCharacterId],
  );
  const stats = useMemo(() => calculateStats(visibleScenes), [visibleScenes]);
  const canEdit = visibleProject?.permissions.canEdit === true;
  const canRunGeneration = visibleProject?.permissions.canRunGeneration ?? canEdit;
  const visibleLoading = Boolean(ownerKey) && (stateOwnerKey !== ownerKey || loading);
  const visibleError = stateOwnerKey === ownerKey ? error : null;
  const markDirty = useCallback((sceneId: number) => {
    dirtyRef.current.add(sceneId);
    setDirtySceneIds(Array.from(dirtyRef.current));
    setSaveError(null);
  }, []);

  const dismissSaveError = useCallback(() => setSaveError(null), []);

  const updateScene = useCallback((sceneId: number, update: Partial<Scene>) => {
    if (reorderingRef.current || !canEdit || !ownsLoadedWorkspace(ownerKey)) return;
    const nextScenes = scenesRef.current.map((scene) =>
      scene.id === sceneId ? {...scene, ...update} : scene,
    );
    replaceScenes(nextScenes);
    editRevisionRef.current.set(sceneId, (editRevisionRef.current.get(sceneId) ?? 0) + 1);
    markDirty(sceneId);
  }, [canEdit, markDirty, ownerKey, ownsLoadedWorkspace, replaceScenes]);

  const saveSceneOnce = useCallback(async (sceneId: number) => {
    const requestedOwnerKey = ownerKey;
    if (!requestedOwnerKey || !ownsLoadedWorkspace(requestedOwnerKey)) return false;
    if (deletingSceneIdsRef.current.has(sceneId)) return false;
    if (!dirtyRef.current.has(sceneId)) return true;
    if (!canEdit) return false;
    const scene = scenesRef.current.find((item) => item.id === sceneId);
    if (!scene) return true;
    const savedRevision = editRevisionRef.current.get(sceneId) ?? 0;

    setSavingSceneIds((current) => Array.from(new Set([...current, sceneId])));
    setSaveError(null);
    try {
      const saved = await scriptApi.updateScene(requestedOwnerKey, scene);
      if (!ownsLoadedWorkspace(requestedOwnerKey)) return false;

      const changedWhileSaving = (editRevisionRef.current.get(sceneId) ?? 0) !== savedRevision;
      replaceScenes(scenesRef.current.map((item) => {
        if (item.id !== sceneId) return item;
        return changedWhileSaving
          ? {...item, version: saved.version, updatedAt: saved.updatedAt}
          : saved;
      }));
      if (!changedWhileSaving) dirtyRef.current.delete(sceneId);
      setDirtySceneIds(Array.from(dirtyRef.current));
      setConflict(null);
      void refreshMissingCharacters();
      return true;
    } catch (saveFailure) {
      if (!ownsLoadedWorkspace(requestedOwnerKey)) return false;
      if (axios.isAxiosError(saveFailure) && saveFailure.response?.status === 409) {
        setConflict({
          sceneId,
          message: 'Сцену изменили в другой вкладке. Перезагрузите данные и повторите правки.',
        });
      } else {
        setSaveError('Сцену не удалось сохранить. Проверьте соединение и повторите попытку.');
      }
      return false;
    } finally {
      if (ownsLoadedWorkspace(requestedOwnerKey)) {
        setSavingSceneIds((current) => current.filter((id) => id !== sceneId));
      }
    }
  }, [
    canEdit,
    ownerKey,
    ownsLoadedWorkspace,
    refreshMissingCharacters,
    replaceScenes,
  ]);

  const saveScene = useCallback((sceneId: number): Promise<boolean> => {
    const saveKey = `${ownerKey}:${sceneId}`;
    const activeSave = savePromisesRef.current.get(saveKey);
    if (activeSave) return activeSave;

    const savePromise = (async () => {
      let saved = await saveSceneOnce(sceneId);
      while (saved && ownsLoadedWorkspace(ownerKey) && dirtyRef.current.has(sceneId)) {
        saved = await saveSceneOnce(sceneId);
      }
      return saved;
    })();
    savePromisesRef.current.set(saveKey, savePromise);
    return savePromise.finally(() => {
      if (savePromisesRef.current.get(saveKey) === savePromise) {
        savePromisesRef.current.delete(saveKey);
      }
    });

  }, [ownerKey, ownsLoadedWorkspace, saveSceneOnce]);

  const saveAllScenes = useCallback(async () => {
    const dirtyIds = Array.from(dirtyRef.current);
    if (dirtyIds.length === 0) return true;
    const results = await Promise.all(dirtyIds.map((sceneId) => saveScene(sceneId)));
    return results.every(Boolean);
  }, [saveScene]);

  const saveSelectedScene = useCallback(async () => {
    const activeReorder = reorderPromiseRef.current;
    if (activeReorder && !await activeReorder) return false;
    if (!ownsLoadedWorkspace(ownerKey)) return false;
    if (visibleSelectedSceneId === null) return true;
    return saveScene(visibleSelectedSceneId);
  }, [ownerKey, ownsLoadedWorkspace, saveScene, visibleSelectedSceneId]);

  const reorderScenes = useCallback((placements: ScenePlacement[]): Promise<boolean> => {
    const requestedOwnerKey = ownerKey;
    if (
      !requestedOwnerKey
      || !canEdit
      || !ownsLoadedWorkspace(requestedOwnerKey)
    ) return Promise.resolve(false);
    if (reorderPromiseRef.current) return reorderPromiseRef.current;

    reorderingRef.current = true;
    setReordering(true);
    const operation = (async () => {
      const saved = await saveAllScenes();
      if (!saved || !ownsLoadedWorkspace(requestedOwnerKey)) return false;

      const placementById = new Map(placements.map((placement) => [placement.id, placement]));
      if (
        placementById.size !== scenesRef.current.length
        || scenesRef.current.some((scene) => !placementById.has(scene.id))
      ) return false;

      const previousPlacements = new Map(scenesRef.current.map((scene) => [
        scene.id,
        {act: scene.act, order: scene.order},
      ]));
      const nextScenes = scenesRef.current.map((scene) => {
        const placement = placementById.get(scene.id);
        return placement ? {...scene, act: placement.act, order: placement.order} : scene;
      });
      const changedIds = nextScenes
        .filter((scene) => {
          const previous = previousPlacements.get(scene.id);
          return previous?.act !== scene.act || previous.order !== scene.order;
        })
        .map((scene) => scene.id);
      if (changedIds.length === 0) return true;

      replaceScenes(nextScenes);
      setSavingSceneIds((current) => Array.from(new Set([...current, ...changedIds])));
      setSaveError(null);
      try {
        const reordered = await scriptApi.reorderScenes(
          requestedOwnerKey,
          nextScenes.map(({id, order, act, version}) => ({id, order, act, version})),
        );
        if (!ownsLoadedWorkspace(requestedOwnerKey)) return false;
        const reorderedById = new Map(reordered.map((scene) => [scene.id, scene]));
        replaceScenes(scenesRef.current.map((scene) => {
          const result = reorderedById.get(scene.id);
          return result ? {
            ...scene,
            act: result.act,
            order: result.order,
            updatedAt: result.updatedAt,
            version: result.version,
          } : scene;
        }));
        setConflict(null);
        return true;
      } catch (reorderFailure) {
        if (!ownsLoadedWorkspace(requestedOwnerKey)) return false;
        replaceScenes(scenesRef.current.map((scene) => {
          const previous = previousPlacements.get(scene.id);
          return previous ? {...scene, ...previous} : scene;
        }));
        if (axios.isAxiosError(reorderFailure) && reorderFailure.response?.status === 409) {
          setConflict({
            sceneId: changedIds[0],
            message: 'Порядок сцен изменили в другой вкладке. Перезагрузите данные и повторите.',
          });
        } else {
          setSaveError('Не удалось изменить порядок сцен. Повторите перетаскивание.');
        }
        return false;
      } finally {
        if (ownsLoadedWorkspace(requestedOwnerKey)) {
          setSavingSceneIds((current) => current.filter((id) => !changedIds.includes(id)));
        }
      }
    })();
    const trackedOperation = operation.finally(() => {
      if (reorderPromiseRef.current === operation) {
        reorderPromiseRef.current = null;
        reorderingRef.current = false;
        if (ownsLoadedWorkspace(requestedOwnerKey)) setReordering(false);
      }
    });
    reorderPromiseRef.current = operation;
    return trackedOperation;
  }, [
    canEdit,
    ownerKey,
    ownsLoadedWorkspace,
    replaceScenes,
    saveAllScenes,
  ]);

  useEffect(() => {
    if (
      !canEdit
      || visibleSelectedSceneId === null
      || conflict
      || saveError
      || !dirtySceneIds.includes(visibleSelectedSceneId)
    ) return undefined;

    const sceneId = visibleSelectedSceneId;
    const timeoutId = window.setTimeout(() => {
      void saveScene(sceneId);
    }, SCRIPT_AUTO_SAVE_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [canEdit, conflict, dirtySceneIds, saveError, saveScene, visibleSelectedSceneId]);

  const selectScene = useCallback(async (sceneId: number) => {
    const requestedOwnerKey = ownerKey;
    const activeReorder = reorderPromiseRef.current;
    if (activeReorder && !await activeReorder) return false;
    if (!ownsLoadedWorkspace(requestedOwnerKey)) return false;
    if (sceneId === visibleSelectedSceneId) return true;
    if (visibleSelectedSceneId !== null) {
      const saved = await saveScene(visibleSelectedSceneId);
      if (!ownsLoadedWorkspace(requestedOwnerKey)) return false;
      if (!saved) return false;
    }
    setSelectedSceneId(sceneId);
    return true;
  }, [ownerKey, ownsLoadedWorkspace, saveScene, visibleSelectedSceneId]);

  const openSceneInScreenplay = useCallback(async (sceneId: number) => {
    const selected = await selectScene(sceneId);
    if (selected && ownsLoadedWorkspace(ownerKey)) setMode('screenplay');
    return selected;
  }, [ownerKey, ownsLoadedWorkspace, selectScene]);

  const changeMode = useCallback(async (nextMode: WorkspaceMode) => {
    const requestedOwnerKey = ownerKey;
    if (!ownsLoadedWorkspace(requestedOwnerKey)) return;
    if (nextMode === mode) return;
    const saved = await saveSelectedScene();
    if (saved && ownsLoadedWorkspace(requestedOwnerKey)) setMode(nextMode);
  }, [mode, ownerKey, ownsLoadedWorkspace, saveSelectedScene]);

  const addScene = useCallback(async () => {
    const requestedOwnerKey = ownerKey;
    if (!requestedOwnerKey || !canEdit || !ownsLoadedWorkspace(requestedOwnerKey)) return;
    if (visibleSelectedSceneId !== null) {
      const saved = await saveScene(visibleSelectedSceneId);
      if (!ownsLoadedWorkspace(requestedOwnerKey)) return;
      if (!saved) return;
    }
    const order = Math.max(0, ...scenesRef.current.map((scene) => scene.order)) + 1;
    const draft: Scene = {
      id: -Date.now(),
      title: `Новая сцена ${order}`,
      description: '',
      scriptText: '',
      scriptBlocks: [],
      status: 'draft',
      order,
      act: Math.min(3, Math.max(1, Math.ceil(order / 3))),
      durationSeconds: 0,
      mood: 'calm',
      sceneType: 'setup',
      notes: '',
      characters: [],
      version: 0,
      updatedAt: '',
    };
    setSavingSceneIds((current) => [...current, draft.id]);
    setSaveError(null);
    try {
      const created = await scriptApi.createScene(requestedOwnerKey, draft);
      if (!ownsLoadedWorkspace(requestedOwnerKey)) return;

      replaceScenes([...scenesRef.current, created]);
      setSelectedSceneId(created.id);
      setMode('screenplay');
      void refreshMissingCharacters();
    } catch {
      if (ownsLoadedWorkspace(requestedOwnerKey)) {
        setSaveError('Сцену не удалось создать. Проверьте соединение и повторите попытку.');
      }
    } finally {
      if (ownsLoadedWorkspace(requestedOwnerKey)) {
        setSavingSceneIds((current) => current.filter((id) => id !== draft.id));
      }
    }
  }, [
    canEdit,
    ownerKey,
    ownsLoadedWorkspace,
    refreshMissingCharacters,
    replaceScenes,
    saveScene,
    visibleSelectedSceneId,
  ]);

  const removeScene = useCallback(async (sceneId: number) => {
    const requestedOwnerKey = ownerKey;
    if (!requestedOwnerKey || !canEdit || !ownsLoadedWorkspace(requestedOwnerKey)) return;
    if (deletingSceneIdsRef.current.has(sceneId)) return;
    deletingSceneIdsRef.current.add(sceneId);
    const activeSave = savePromisesRef.current.get(`${requestedOwnerKey}:${sceneId}`);
    if (activeSave) await activeSave;
    if (!ownsLoadedWorkspace(requestedOwnerKey)) {
      deletingSceneIdsRef.current.delete(sceneId);
      return;
    }
    setSavingSceneIds((current) => [...current, sceneId]);
    setSaveError(null);
    try {
      await scriptApi.deleteScene(requestedOwnerKey, sceneId);
      if (!ownsLoadedWorkspace(requestedOwnerKey)) return;

      const remaining = scenesRef.current.filter((scene) => scene.id !== sceneId);
      replaceScenes(remaining);
      dirtyRef.current.delete(sceneId);
      editRevisionRef.current.delete(sceneId);
      setDirtySceneIds(Array.from(dirtyRef.current));
      setSelectedSceneId((current) => current === sceneId ? remaining[0]?.id ?? null : current);
      void refreshMissingCharacters();
    } catch {
      if (ownsLoadedWorkspace(requestedOwnerKey)) {
        setSaveError('Сцену не удалось удалить. Повторите попытку.');
      }
    } finally {
      deletingSceneIdsRef.current.delete(sceneId);
      if (ownsLoadedWorkspace(requestedOwnerKey)) {
        setSavingSceneIds((current) => current.filter((id) => id !== sceneId));
      }
    }
  }, [
    canEdit,
    ownerKey,
    ownsLoadedWorkspace,
    refreshMissingCharacters,
    replaceScenes,
  ]);

  const updateCharacterPersonality = useCallback(async (
    characterId: string,
    writingFields: Record<string, string>,
  ) => {
    const requestedOwnerKey = ownerKey;
    if (!requestedOwnerKey || !canEdit || !ownsLoadedWorkspace(requestedOwnerKey)) return false;
    const character = visibleCharacters.find((item) => item.id === characterId);
    if (!character) return false;
    const personality = {...character.personality, ...writingFields};
    try {
      await characterApi.update(requestedOwnerKey, characterId, {personality});
      if (!ownsLoadedWorkspace(requestedOwnerKey)) return false;

      setCharacters((current) => current.map((item) =>
        item.id === characterId ? {...item, personality} : item,
      ));
      return true;
    } catch {
      return false;
    }
  }, [canEdit, ownerKey, ownsLoadedWorkspace, visibleCharacters]);
  return {
    mode,
    project: visibleProject,
    scenes: visibleScenes,
    characters: visibleCharacters,
    missingCharacters: visibleMissingCharacters,
    selectedScene,
    selectedCharacter,
    selectedSceneId: visibleSelectedSceneId,
    selectedCharacterId: visibleSelectedCharacterId,
    characterSceneFilter: visibleCharacterSceneFilter,
    stats: visibleProject ? stats : EMPTY_STATS,
    canEdit,
    canRunGeneration,
    loading: visibleLoading,
    error: visibleError,
    saveError: ownsVisibleData ? saveError : null,
    missingCharactersError: ownsVisibleData ? missingCharactersError : null,
    conflict: ownsVisibleData ? conflict : null,
    dirtySceneIds: ownsVisibleData ? dirtySceneIds : [],
    savingSceneIds: ownsVisibleData ? savingSceneIds : [],
    reordering: ownsVisibleData && reordering,
    changeMode,
    setSelectedCharacterId,
    setCharacterSceneFilter,
    selectScene,
    openSceneInScreenplay,
    updateScene,
    reorderScenes,
    saveSelectedScene,
    dismissSaveError,
    addScene,
    removeScene,
    reload: loadWorkspace,
    refreshMissingCharacters,
    updateCharacterPersonality,
  };
}
