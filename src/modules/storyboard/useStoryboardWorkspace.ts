import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {createInitialKeyframes, isShotReady, sortKeyframes} from './model';
import type {
  CameraIntent,
  CameraMovementType,
  GenerationReference,
  KeyframeTransition,
  StoryboardKeyframe,
  StoryboardScene,
  StoryboardShot,
  StoryboardShotSource,
} from './model';

export type StoryboardMode = 'overview' | 'builder' | 'editor';
export type AutosaveState = 'saved' | 'saving' | 'unsaved';

let localIdCounter = 0;

function createLocalId(prefix: string): string {
  localIdCounter += 1;
  return `${prefix}-${Date.now()}-${localIdCounter}`;
}

export interface NewShotInput {
  characterIds?: string[];
  description: string;
  locationId?: string;
  referenceIds?: string[];
  source?: StoryboardShotSource;
  title: string;
}

function cloneIntent(intent: CameraIntent): CameraIntent {
  return {
    ...intent,
    composition: intent.composition?.map((subject) => ({...subject})),
    ots: intent.ots ? {...intent.ots} : undefined,
  };
}

function cloneKeyframe(keyframe: StoryboardKeyframe): StoryboardKeyframe {
  return {
    ...keyframe,
    cameraIntent: cloneIntent(keyframe.cameraIntent),
    generationReferences: keyframe.generationReferences?.map((reference) => ({...reference})),
  };
}

function cloneShot(shot: StoryboardShot): StoryboardShot {
  const cloned: StoryboardShot = {
    ...shot,
    characterIds: [...shot.characterIds],
    keyframes: shot.keyframes.map(cloneKeyframe),
    referenceIds: [...shot.referenceIds],
    source: shot.source ? {...shot.source, segmentIds: [...shot.source.segmentIds]} : undefined,
    transitions: shot.transitions.map((transition) => ({...transition})),
  };
  const initial = createInitialKeyframes(shot.id, {
    end: cloned.keyframes.find(({type}) => type === 'end')?.cameraIntent,
    start: cloned.keyframes.find(({type}) => type === 'start')?.cameraIntent,
  });
  const keyframes = sortKeyframes([
    ...cloned.keyframes,
    ...initial.filter(({type}) => !cloned.keyframes.some((keyframe) => keyframe.type === type)),
  ]);
  return {...cloned, keyframes, transitions: buildTransitions(shot.id, keyframes, cloned.transitions)};
}

function buildTransitions(
  shotId: string,
  keyframes: StoryboardKeyframe[],
  previous: KeyframeTransition[] = [],
): KeyframeTransition[] {
  const ordered = sortKeyframes(keyframes);
  return ordered.slice(0, -1).map((keyframe, index) => {
    const next = ordered[index + 1];
    const existing = previous.find(({fromKeyframeId, toKeyframeId}) => (
      fromKeyframeId === keyframe.id && toKeyframeId === next.id
    ));
    return existing ?? {
      fromKeyframeId: keyframe.id,
      id: `${shotId}-${keyframe.id}-to-${next.id}`,
      toKeyframeId: next.id,
    };
  });
}

function deriveSceneStatus(shots: StoryboardShot[]): StoryboardScene['status'] {
  if (shots.length === 0) return 'empty';
  return shots.every(isShotReady) ? 'completed' : 'draft';
}

export function createShot(
  scene: StoryboardScene,
  input: NewShotInput,
  order: number,
): StoryboardShot {
  const id = createLocalId(`${scene.id}-shot`);
  const keyframes = createInitialKeyframes(id, {
    end: {targetId: input.characterIds?.[0] || input.referenceIds?.[0]},
    start: {targetId: input.characterIds?.[0] || input.referenceIds?.[0]},
  });
  return {
    characterIds: input.characterIds ?? [],
    description: input.description,
    duration: 4,
    id,
    keyframes,
    locationId: input.locationId,
    order,
    referenceIds: input.referenceIds ?? [],
    sceneId: scene.id,
    source: input.source,
    title: input.title,
    transitions: buildTransitions(id, keyframes),
  };
}

export function createMockShotList(scene: StoryboardScene): StoryboardShot[] {
  const templates = [
    ['Wide shot', 'Anna enters the kitchen.'],
    ['Medium shot', 'Anna notices the envelope.'],
    ['Close-up', 'Envelope lying on the table.'],
    ['Medium close-up', 'Anna picks up the envelope.'],
    ['Close-up', 'Anna reacts to what she sees.'],
  ] as const;
  const characterIds = scene.entities.filter(({type}) => type === 'character').map(({id}) => id);
  const locationId = scene.entities.find(({type}) => type === 'location')?.id ?? scene.locationIds[0];
  const referenceIds = scene.entities.filter(({type}) => type === 'object').map(({id}) => id);
  return templates.map(([title, description], index) => createShot(scene, {
    characterIds,
    description,
    locationId,
    referenceIds,
    title,
  }, index + 1));
}

export function useStoryboardWorkspace(
  projectId: string,
  loadScenes: (projectId: string) => Promise<StoryboardScene[]>,
) {
  const [scenes, setScenes] = useState<StoryboardScene[]>([]);
  const [mode, setMode] = useState<StoryboardMode>('overview');
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('saved');
  const [loading, setLoading] = useState(Boolean(projectId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const savedTimerRef = useRef<number | null>(null);
  const loadRequestRef = useRef({requestId: 0, loadedProjectId: null as string | null});
  // Fast Refresh can retain the previous numeric counter in an open draft.
  if (typeof loadRequestRef.current === 'number') {
    loadRequestRef.current = {requestId: loadRequestRef.current, loadedProjectId: null};
  }
  const selectedSceneIdRef = useRef<string | null>(null);

  const reload = useCallback(async () => {
    const requestId = loadRequestRef.current.requestId + 1;
    loadRequestRef.current = {requestId, loadedProjectId: null};
    setScenes([]);
    selectedSceneIdRef.current = null;
    setSelectedSceneId(null);
    setSelectedShotId(null);
    setSelectedKeyframeId(null);
    setMode('overview');
    setLoadError(null);
    setLoading(Boolean(projectId));
    if (!projectId) return;

    try {
      const loadedScenes = await loadScenes(projectId);
      if (loadRequestRef.current.requestId !== requestId) return;
      loadRequestRef.current.loadedProjectId = projectId;
      setScenes(loadedScenes);
    } catch {
      if (loadRequestRef.current.requestId !== requestId) return;
      setLoadError('storyboard.errors.workspace');
    } finally {
      if (loadRequestRef.current.requestId === requestId) setLoading(false);
    }
  }, [loadScenes, projectId]);

  useEffect(() => {
    void reload();
    return () => {
      loadRequestRef.current.requestId += 1;
    };
  }, [reload]);

  useEffect(() => () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
  }, []);

  const markDirty = useCallback(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    setAutosaveState('unsaved');
    saveTimerRef.current = window.setTimeout(() => {
      setAutosaveState('saving');
      savedTimerRef.current = window.setTimeout(() => setAutosaveState('saved'), 500);
    }, 350);
  }, []);

  const selectedScene = useMemo(
    () => scenes.find(({id}) => id === selectedSceneId) ?? null,
    [scenes, selectedSceneId],
  );
  const selectedShot = useMemo(
    () => selectedScene?.shots.find(({id}) => id === selectedShotId) ?? null,
    [selectedScene, selectedShotId],
  );
  const selectedKeyframe = useMemo(
    () => selectedShot?.keyframes.find(({id}) => id === selectedKeyframeId) ?? null,
    [selectedKeyframeId, selectedShot],
  );
  const previousShot = useMemo(() => {
    if (!selectedScene || !selectedShot) return undefined;
    return [...selectedScene.shots]
      .sort((first, second) => first.order - second.order)
      .filter(({order}) => order < selectedShot.order)
      .pop();
  }, [selectedScene, selectedShot]);

  const updateSelectedScene = useCallback((updater: (scene: StoryboardScene) => StoryboardScene) => {
    if (!selectedSceneId) return;
    setScenes((current) => current.map((scene) => {
      if (scene.id !== selectedSceneId) return scene;
      const nextScene = updater(scene);
      return {
        ...nextScene,
        readyShotsCount: nextScene.shots.filter(isShotReady).length,
        shotsCount: nextScene.shots.length,
      };
    }));
    markDirty();
  }, [markDirty, selectedSceneId]);

  const selectScene = useCallback((sceneId: string) => {
    const scene = scenes.find(({id}) => id === sceneId);
    selectedSceneIdRef.current = sceneId;
    setSelectedSceneId(sceneId);
    setSelectedShotId(null);
    setSelectedKeyframeId(null);
    setMode(scene?.shots.length ? 'builder' : 'overview');
  }, [scenes]);

  const setSceneShotList = useCallback((sceneId: string, shots: StoryboardShot[]) => {
    setScenes((current) => current.map((scene) => scene.id === sceneId ? {
      ...scene,
      readyShotsCount: shots.filter(isShotReady).length,
      shots: shots.map((shot, index) => ({...cloneShot(shot), order: index + 1, sceneId})),
      shotsCount: shots.length,
      status: deriveSceneStatus(shots),
    } : scene));
    markDirty();
    if (selectedSceneIdRef.current !== sceneId) return;
    setMode((currentMode) => {
      if (shots.length === 0) return 'overview';
      return currentMode === 'editor' ? 'editor' : 'builder';
    });
  }, [markDirty]);

  const setShotList = useCallback((shots: StoryboardShot[]) => {
    if (selectedSceneId) setSceneShotList(selectedSceneId, shots);
  }, [selectedSceneId, setSceneShotList]);

  const addShot = useCallback((input: NewShotInput, afterShotId?: string) => {
    if (!selectedScene) return;
    const newShot = createShot(selectedScene, input, selectedScene.shots.length + 1);
    const insertionIndex = afterShotId
      ? selectedScene.shots.findIndex(({id}) => id === afterShotId) + 1
      : selectedScene.shots.length;
    const shots = [...selectedScene.shots];
    shots.splice(insertionIndex, 0, newShot);
    setShotList(shots);
  }, [selectedScene, setShotList]);

  const updateShot = useCallback((shotId: string, patch: Partial<StoryboardShot>) => {
    updateSelectedScene((scene) => ({
      ...scene,
      shots: scene.shots.map((shot) => shot.id === shotId ? {...shot, ...patch} : shot),
    }));
  }, [updateSelectedScene]);

  const moveShot = useCallback((shotId: string, targetIndex: number) => {
    if (!selectedScene) return;
    const shots = [...selectedScene.shots];
    const sourceIndex = shots.findIndex(({id}) => id === shotId);
    if (sourceIndex < 0) return;
    const [shot] = shots.splice(sourceIndex, 1);
    shots.splice(Math.max(0, Math.min(targetIndex, shots.length)), 0, shot);
    setShotList(shots);
  }, [selectedScene, setShotList]);

  const duplicateShot = useCallback((shotId: string, copySuffix = 'Copy') => {
    if (!selectedScene) return;
    const sourceIndex = selectedScene.shots.findIndex(({id}) => id === shotId);
    if (sourceIndex < 0) return;
    const source = selectedScene.shots[sourceIndex];
    const nextId = createLocalId(`${source.sceneId}-shot`);
    const idMap = new Map(source.keyframes.map((keyframe, index) => [
      keyframe.id,
      `${nextId}-${keyframe.type}-${index + 1}`,
    ]));
    const keyframes = source.keyframes.map((keyframe) => ({
      ...cloneKeyframe(keyframe),
      generationReferences: undefined,
      id: idMap.get(keyframe.id) || keyframe.id,
      imageUrl: undefined,
      generationStatus: 'idle' as const,
      shotId: nextId,
    }));
    const duplicate: StoryboardShot = {
      ...cloneShot(source),
      id: nextId,
      keyframes,
      title: `${source.title} · ${copySuffix}`,
      transitions: source.transitions.map((transition, index) => ({
        ...transition,
        fromKeyframeId: idMap.get(transition.fromKeyframeId) || transition.fromKeyframeId,
        id: `${nextId}-transition-${index}`,
        toKeyframeId: idMap.get(transition.toKeyframeId) || transition.toKeyframeId,
      })),
    };
    const shots = [...selectedScene.shots];
    shots.splice(sourceIndex + 1, 0, duplicate);
    setShotList(shots);
  }, [selectedScene, setShotList]);

  const deleteShot = useCallback((shotId: string) => {
    if (!selectedScene) return;
    const sourceIndex = selectedScene.shots.findIndex(({id}) => id === shotId);
    const shots = selectedScene.shots.filter(({id}) => id !== shotId);
    setShotList(shots);
    if (selectedShotId === shotId) {
      const replacement = shots[Math.min(sourceIndex, shots.length - 1)];
      setSelectedShotId(replacement?.id ?? null);
      setSelectedKeyframeId(replacement ? sortKeyframes(replacement.keyframes)[0]?.id ?? null : null);
    }
  }, [selectedScene, selectedShotId, setShotList]);

  const enterEditor = useCallback(() => {
    if (!selectedScene?.shots.length) return;
    const firstShot = [...selectedScene.shots].sort((a, b) => a.order - b.order)[0];
    setSelectedShotId(firstShot.id);
    setSelectedKeyframeId(sortKeyframes(firstShot.keyframes)[0]?.id ?? null);
    setMode('editor');
  }, [selectedScene]);

  const selectShot = useCallback((shotId: string) => {
    const shot = selectedScene?.shots.find(({id}) => id === shotId);
    setSelectedShotId(shotId);
    setSelectedKeyframeId(shot ? sortKeyframes(shot.keyframes)[0]?.id ?? null : null);
  }, [selectedScene]);

  const updateSelectedShot = useCallback((updater: (shot: StoryboardShot) => StoryboardShot) => {
    if (!selectedShotId) return;
    updateSelectedScene((scene) => {
      const shots = scene.shots.map((shot) => (
        shot.id === selectedShotId ? updater(shot) : shot
      ));
      return {...scene, shots, status: deriveSceneStatus(shots)};
    });
  }, [selectedShotId, updateSelectedScene]);

  const addIntermediate = useCallback(() => {
    if (!selectedShot) return;
    const ordered = sortKeyframes(selectedShot.keyframes);
    let widestGap = 0;
    let position = 0.5;
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const gap = ordered[index + 1].position - ordered[index].position;
      if (gap > widestGap) {
        widestGap = gap;
        position = ordered[index].position + gap / 2;
      }
    }
    const source = selectedKeyframe ?? ordered[0];
    if (!source) return;
    const keyframe: StoryboardKeyframe = {
      cameraIntent: cloneIntent(source.cameraIntent),
      generationStatus: 'idle',
      id: createLocalId(`${selectedShot.id}-intermediate`),
      position,
      shotId: selectedShot.id,
      type: 'intermediate',
    };
    updateSelectedShot((shot) => {
      const keyframes = sortKeyframes([...shot.keyframes, keyframe]);
      return {...shot, keyframes, transitions: buildTransitions(shot.id, keyframes, shot.transitions)};
    });
    setSelectedKeyframeId(keyframe.id);
  }, [selectedKeyframe, selectedShot, updateSelectedShot]);

  const deleteKeyframe = useCallback((keyframeId: string) => {
    if (!selectedShot) return;
    const keyframes = selectedShot.keyframes.filter(({id, type}) => id !== keyframeId || type !== 'intermediate');
    updateSelectedShot((shot) => ({
      ...shot,
      keyframes,
      transitions: buildTransitions(shot.id, keyframes, shot.transitions),
    }));
    if (selectedKeyframeId === keyframeId) {
      setSelectedKeyframeId(sortKeyframes(keyframes)[0]?.id ?? null);
    }
  }, [selectedKeyframeId, selectedShot, updateSelectedShot]);

  const repositionKeyframe = useCallback((keyframeId: string, position: number) => {
    updateSelectedShot((shot) => {
      const keyframes = shot.keyframes.map((keyframe) => (
        keyframe.id === keyframeId && keyframe.type === 'intermediate'
          ? {...keyframe, position: Math.max(0.02, Math.min(0.98, position))}
          : keyframe
      ));
      return {...shot, keyframes, transitions: buildTransitions(shot.id, keyframes, shot.transitions)};
    });
  }, [updateSelectedShot]);

  const updateCameraIntent = useCallback((intent: CameraIntent) => {
    if (!selectedKeyframeId) return;
    updateSelectedShot((shot) => ({
      ...shot,
      keyframes: shot.keyframes.map((keyframe) => (
        keyframe.id === selectedKeyframeId ? {...keyframe, cameraIntent: cloneIntent(intent)} : keyframe
      )),
    }));
  }, [selectedKeyframeId, updateSelectedShot]);

  const updateTransition = useCallback((transitionId: string, movementOverride?: CameraMovementType) => {
    updateSelectedShot((shot) => ({
      ...shot,
      transitions: shot.transitions.map((transition) => (
        transition.id === transitionId ? {...transition, movementOverride} : transition
      )),
    }));
  }, [updateSelectedShot]);

  const generateSelectedKeyframe = useCallback((
    references: GenerationReference[],
    imageUrl: string,
  ) => {
    if (!selectedKeyframeId) return;
    updateSelectedShot((shot) => ({
      ...shot,
      keyframes: shot.keyframes.map((keyframe) => keyframe.id === selectedKeyframeId ? {
        ...keyframe,
        generationReferences: references.map((reference) => ({...reference})),
        generationStatus: 'ready',
        imageUrl,
      } : keyframe),
    }));
  }, [selectedKeyframeId, updateSelectedShot]);

  return {
    addIntermediate,
    addShot,
    autosaveState,
    deleteKeyframe,
    deleteShot,
    duplicateShot,
    enterEditor,
    generateSelectedKeyframe,
    loadError,
    loadedProjectId: loadRequestRef.current.loadedProjectId,
    loading,
    mode,
    moveShot,
    previousShot,
    repositionKeyframe,
    reload,
    scenes,
    selectScene,
    selectShot,
    selectedKeyframe,
    selectedKeyframeId,
    selectedScene,
    selectedSceneId,
    selectedShot,
    selectedShotId,
    setMode,
    setSelectedKeyframeId,
    setSceneShotList,
    setShotList,
    updateCameraIntent,
    updateSelectedShot,
    updateShot,
    updateTransition,
  };
}
