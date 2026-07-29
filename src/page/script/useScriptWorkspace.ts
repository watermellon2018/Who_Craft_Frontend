import axios from 'axios';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {characterApi} from '../../modules/character-studio/api/characterApi';
import {scriptApi} from './api';
import type {
  CompactCharacter,
  Scene,
  ScriptProject,
  ScriptStats,
  WorkspaceConflict,
  WorkspaceMode,
} from './types';

const EMPTY_STATS: ScriptStats = {sceneCount: 0, totalDurationSeconds: 0, acts: []};

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
  const ownerKey = projectId;
  const [mode, setMode] = useState<WorkspaceMode>('cards');
  const [project, setProject] = useState<ScriptProject | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [characters, setCharacters] = useState<CompactCharacter[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<number | null>(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [characterSceneFilter, setCharacterSceneFilter] = useState<string | null>(null);
  const [dirtySceneIds, setDirtySceneIds] = useState<number[]>([]);
  const [savingSceneIds, setSavingSceneIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<WorkspaceConflict | null>(null);
  const [stateOwnerKey, setStateOwnerKey] = useState(ownerKey);
  const [dataOwnerKey, setDataOwnerKey] = useState<string | null>(null);
  const ownerKeyRef = useRef(ownerKey);
  const loadedOwnerKeyRef = useRef<string | null>(null);
  const loadRequestRef = useRef(0);
  const scenesRef = useRef<Scene[]>([]);
  const dirtyRef = useRef(new Set<number>());
  const editRevisionRef = useRef(new Map<number, number>());
  const savePromisesRef = useRef(new Map<string, Promise<boolean>>());

  if (ownerKeyRef.current !== ownerKey) {
    ownerKeyRef.current = ownerKey;
    loadedOwnerKeyRef.current = null;
    loadRequestRef.current += 1;
    scenesRef.current = [];
    dirtyRef.current.clear();
    editRevisionRef.current.clear();
    savePromisesRef.current.clear();
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
    loadedOwnerKeyRef.current = null;
    scenesRef.current = [];
    dirtyRef.current.clear();
    editRevisionRef.current.clear();
    savePromisesRef.current.clear();
    setStateOwnerKey(requestedOwnerKey);
    setDataOwnerKey(null);
    setProject(null);
    setScenes([]);
    setCharacters([]);
    setSelectedSceneId(null);
    setSelectedCharacterId(null);
    setCharacterSceneFilter(null);
    setDirtySceneIds([]);
    setSavingSceneIds([]);
    setMode('cards');
    setError(null);
    setConflict(null);
    setSaveError(null);
    setLoading(Boolean(requestedOwnerKey));
    if (!requestedOwnerKey) return;

    const isCurrentRequest = () => (
      ownerKeyRef.current === requestedOwnerKey
      && loadRequestRef.current === requestToken
    );

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
  }, [ownerKey, replaceScenes]);

  useEffect(() => {
    void loadWorkspace();
    return () => {
      loadRequestRef.current += 1;
    };
  }, [loadWorkspace]);

  const ownsLoadedWorkspace = useCallback((requestedOwnerKey: string) => (
    ownerKeyRef.current === requestedOwnerKey
    && loadedOwnerKeyRef.current === requestedOwnerKey
  ), []);

  const ownsVisibleData = stateOwnerKey === ownerKey && dataOwnerKey === ownerKey;
  const visibleProject = ownsVisibleData ? project : null;
  const visibleScenes = useMemo(() => ownsVisibleData ? scenes : [], [ownsVisibleData, scenes]);
  const visibleCharacters = useMemo(
    () => ownsVisibleData ? characters : [],
    [characters, ownsVisibleData],
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
  const visibleLoading = Boolean(ownerKey) && (stateOwnerKey !== ownerKey || loading);
  const visibleError = stateOwnerKey === ownerKey ? error : null;
  const markDirty = useCallback((sceneId: number) => {
    dirtyRef.current.add(sceneId);
    setDirtySceneIds(Array.from(dirtyRef.current));
    setSaveError(null);
  }, []);

  const dismissSaveError = useCallback(() => setSaveError(null), []);

  const updateScene = useCallback((sceneId: number, update: Partial<Scene>) => {
    if (!canEdit || !ownsLoadedWorkspace(ownerKey)) return;
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
  }, [canEdit, ownerKey, ownsLoadedWorkspace, replaceScenes]);

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

  const saveSelectedScene = useCallback(async () => {
    if (!ownsLoadedWorkspace(ownerKey)) return false;
    if (visibleSelectedSceneId === null) return true;
    return saveScene(visibleSelectedSceneId);
  }, [ownerKey, ownsLoadedWorkspace, saveScene, visibleSelectedSceneId]);

  const selectScene = useCallback(async (sceneId: number) => {
    const requestedOwnerKey = ownerKey;
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
      scriptBlocks: [{id: crypto.randomUUID(), type: 'scene_heading', text: 'ИНТ. ЛОКАЦИЯ — ДЕНЬ'}],
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
      setMode('cards');
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
    replaceScenes,
    saveScene,
    visibleSelectedSceneId,
  ]);

  const removeScene = useCallback(async (sceneId: number) => {
    const requestedOwnerKey = ownerKey;
    if (!requestedOwnerKey || !canEdit || !ownsLoadedWorkspace(requestedOwnerKey)) return;
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
    } catch {
      if (ownsLoadedWorkspace(requestedOwnerKey)) {
        setSaveError('Сцену не удалось удалить. Повторите попытку.');
      }
    } finally {
      if (ownsLoadedWorkspace(requestedOwnerKey)) {
        setSavingSceneIds((current) => current.filter((id) => id !== sceneId));
      }
    }
  }, [canEdit, ownerKey, ownsLoadedWorkspace, replaceScenes]);

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
    selectedScene,
    selectedCharacter,
    selectedSceneId: visibleSelectedSceneId,
    selectedCharacterId: visibleSelectedCharacterId,
    characterSceneFilter: visibleCharacterSceneFilter,
    stats: visibleProject ? stats : EMPTY_STATS,
    canEdit,
    loading: visibleLoading,
    error: visibleError,
    saveError: ownsVisibleData ? saveError : null,
    conflict: ownsVisibleData ? conflict : null,
    dirtySceneIds: ownsVisibleData ? dirtySceneIds : [],
    savingSceneIds: ownsVisibleData ? savingSceneIds : [],
    changeMode,
    setSelectedCharacterId,
    setCharacterSceneFilter,
    selectScene,
    updateScene,
    saveSelectedScene,
    dismissSaveError,
    addScene,
    removeScene,
    reload: loadWorkspace,
    updateCharacterPersonality,
  };
}
