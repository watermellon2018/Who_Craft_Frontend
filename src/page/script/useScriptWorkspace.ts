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
  const scenesRef = useRef<Scene[]>([]);
  const dirtyRef = useRef(new Set<number>());
  const editRevisionRef = useRef(new Map<number, number>());
  const savePromisesRef = useRef(new Map<number, Promise<boolean>>());

  const replaceScenes = useCallback((nextScenes: Scene[]) => {
    const sorted = [...nextScenes].sort((left, right) => left.order - right.order);
    scenesRef.current = sorted;
    setScenes(sorted);
  }, []);

  const loadWorkspace = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    setConflict(null);
    setSaveError(null);
    try {
      const [workspace, compactCharacters] = await Promise.all([
        scriptApi.getWorkspace(projectId),
        scriptApi.getCharacters(projectId),
      ]);
      setProject(workspace.project);
      replaceScenes(workspace.scenes);
      setCharacters(compactCharacters);
      setSelectedSceneId((current) => {
        if (current && workspace.scenes.some((scene) => scene.id === current)) return current;
        return workspace.scenes[0]?.id ?? null;
      });
      setSelectedCharacterId((current) => {
        if (current && compactCharacters.some((character) => character.id === current)) return current;
        return compactCharacters[0]?.id ?? null;
      });
      dirtyRef.current.clear();
      editRevisionRef.current.clear();
      setDirtySceneIds([]);
    } catch (loadError) {
      setError(describeApiError(loadError));
    } finally {
      setLoading(false);
    }
  }, [projectId, replaceScenes]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const selectedScene = useMemo(
    () => scenes.find((scene) => scene.id === selectedSceneId) ?? null,
    [scenes, selectedSceneId],
  );
  const selectedCharacter = useMemo(
    () => characters.find((character) => character.id === selectedCharacterId) ?? null,
    [characters, selectedCharacterId],
  );
  const stats = useMemo(() => calculateStats(scenes), [scenes]);
  const canEdit = project?.permissions.canEdit === true;

  const markDirty = useCallback((sceneId: number) => {
    dirtyRef.current.add(sceneId);
    setDirtySceneIds(Array.from(dirtyRef.current));
    setSaveError(null);
  }, []);

  const dismissSaveError = useCallback(() => setSaveError(null), []);

  const updateScene = useCallback((sceneId: number, update: Partial<Scene>) => {
    if (!canEdit) return;
    const nextScenes = scenesRef.current.map((scene) =>
      scene.id === sceneId ? {...scene, ...update} : scene,
    );
    replaceScenes(nextScenes);
    editRevisionRef.current.set(sceneId, (editRevisionRef.current.get(sceneId) ?? 0) + 1);
    markDirty(sceneId);
  }, [canEdit, markDirty, replaceScenes]);

  const saveSceneOnce = useCallback(async (sceneId: number) => {
    if (!projectId || !canEdit || !dirtyRef.current.has(sceneId)) return true;
    const scene = scenesRef.current.find((item) => item.id === sceneId);
    if (!scene) return true;
    const savedRevision = editRevisionRef.current.get(sceneId) ?? 0;

    setSavingSceneIds((current) => Array.from(new Set([...current, sceneId])));
    setSaveError(null);
    try {
      const saved = await scriptApi.updateScene(projectId, scene);
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
      setSavingSceneIds((current) => current.filter((id) => id !== sceneId));
    }
  }, [canEdit, projectId, replaceScenes]);

  const saveScene = useCallback((sceneId: number): Promise<boolean> => {
    const activeSave = savePromisesRef.current.get(sceneId);
    if (activeSave) return activeSave;

    const savePromise = (async () => {
      try {
        let saved = await saveSceneOnce(sceneId);
        while (saved && dirtyRef.current.has(sceneId)) {
          saved = await saveSceneOnce(sceneId);
        }
        return saved;
      } finally {
        savePromisesRef.current.delete(sceneId);
      }
    })();
    savePromisesRef.current.set(sceneId, savePromise);
    return savePromise;

  }, [saveSceneOnce]);
  const saveSelectedScene = useCallback(async () => {
    if (selectedSceneId === null) return true;
    return saveScene(selectedSceneId);
  }, [saveScene, selectedSceneId]);

  const selectScene = useCallback(async (sceneId: number) => {
    if (sceneId === selectedSceneId) return true;
    if (selectedSceneId !== null) {
      const saved = await saveScene(selectedSceneId);
      if (!saved) return false;
    }
    setSelectedSceneId(sceneId);
    return true;
  }, [saveScene, selectedSceneId]);

  const changeMode = useCallback(async (nextMode: WorkspaceMode) => {
    if (nextMode === mode) return;
    const saved = await saveSelectedScene();
    if (saved) setMode(nextMode);
  }, [mode, saveSelectedScene]);

  const addScene = useCallback(async () => {
    if (!projectId || !canEdit) return;
    if (selectedSceneId !== null) {
      const saved = await saveScene(selectedSceneId);
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
      const created = await scriptApi.createScene(projectId, draft);
      replaceScenes([...scenesRef.current, created]);
      setSelectedSceneId(created.id);
      setMode('cards');
    } catch {
      setSaveError('Сцену не удалось создать. Проверьте соединение и повторите попытку.');
    } finally {
      setSavingSceneIds((current) => current.filter((id) => id !== draft.id));
    }
  }, [canEdit, projectId, replaceScenes, saveScene, selectedSceneId]);

  const removeScene = useCallback(async (sceneId: number) => {
    if (!projectId || !canEdit) return;
    setSavingSceneIds((current) => [...current, sceneId]);
    setSaveError(null);
    try {
      await scriptApi.deleteScene(projectId, sceneId);
      const remaining = scenesRef.current.filter((scene) => scene.id !== sceneId);
      replaceScenes(remaining);
      dirtyRef.current.delete(sceneId);
      editRevisionRef.current.delete(sceneId);
      setDirtySceneIds(Array.from(dirtyRef.current));
      setSelectedSceneId((current) => current === sceneId ? remaining[0]?.id ?? null : current);
    } catch {
      setSaveError('Сцену не удалось удалить. Повторите попытку.');
    } finally {
      setSavingSceneIds((current) => current.filter((id) => id !== sceneId));
    }
  }, [canEdit, projectId, replaceScenes]);

  const updateCharacterPersonality = useCallback(async (
    characterId: string,
    writingFields: Record<string, string>,
  ) => {
    if (!projectId || !canEdit) return false;
    const character = characters.find((item) => item.id === characterId);
    if (!character) return false;
    const personality = {...character.personality, ...writingFields};
    try {
      await characterApi.update(projectId, characterId, {personality});
      setCharacters((current) => current.map((item) =>
        item.id === characterId ? {...item, personality} : item,
      ));
      return true;
    } catch {
      return false;
    }
  }, [canEdit, characters, projectId]);

  return {
    mode,
    project,
    scenes,
    characters,
    selectedScene,
    selectedCharacter,
    selectedSceneId,
    selectedCharacterId,
    characterSceneFilter,
    stats: project ? stats : EMPTY_STATS,
    canEdit,
    loading,
    error,
    saveError,
    conflict,
    dirtySceneIds,
    savingSceneIds,
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
