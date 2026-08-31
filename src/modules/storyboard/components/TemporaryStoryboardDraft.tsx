import {Button} from 'antd';
import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {AUTH_EXPIRED_EVENT} from '../../../api/http';
import {fetchProfileMe} from '../../profile/api/profileApi';
import type {StoryboardScene, StoryboardShot} from '../model';
import {
  normalizeTemporaryShots,
  readTemporaryDraft,
  removeTemporaryDraft,
  writeTemporaryDraft,
} from '../temporaryDraft';
import type {TemporaryStoryboardDraft as Draft} from '../temporaryDraft';

interface TemporaryStoryboardDraftProps {
  enabled: boolean;
  loadError: string | null;
  loading: boolean;
  onRestore: (sceneId: string, shots: StoryboardShot[]) => void;
  projectId: string;
  scenes: StoryboardScene[];
}

interface DraftSession {
  conflictedSceneIds: Set<string>;
  draft: Draft;
  hadDraft: boolean;
  initialized: boolean;
  pendingRestores: Map<string, string>;
  signature?: string;
  suspendedSignature?: string;
}

type DraftStatus = 'saved' | 'restored' | 'removed' | 'unavailable' | 'conflict' | 'paused' | null;

export default function TemporaryStoryboardDraft(props: TemporaryStoryboardDraftProps) {
  const {enabled, loading, loadError, projectId, scenes} = props;
  const {t} = useTranslation();
  const [status, setStatus] = useState<DraftStatus>(null);
  const session = useRef<DraftSession | null>(null);
  const authPaused = useRef(false);
  const latest = useRef(props);
  latest.current = props;
  const synchronize = useRef<() => void>(() => undefined);

  synchronize.current = () => {
    const current = latest.current;
    const active = session.current;
    if (!active || authPaused.current || !current.enabled || current.loading || current.loadError
      || active.draft.projectId !== current.projectId) return;
    try {
      const normalized: Record<string, StoryboardShot[]> = {};
      for (const scene of current.scenes) {
        const shots = normalizeTemporaryShots(scene.shots, scene.id);
        if (!shots) throw new Error('Invalid storyboard draft');
        normalized[scene.id] = shots;
      }
      const signature = JSON.stringify(normalized);
      if (active.suspendedSignature === signature) return;
      active.suspendedSignature = undefined;
      let restored = false;
      for (const scene of current.scenes) {
        const shots = normalized[scene.id];
        const saved = active.draft.scenes[scene.id];
        const shotSignature = JSON.stringify(shots);
        if (!active.initialized && saved !== undefined && shots.length
          && shotSignature !== JSON.stringify(saved)) {
          // The loaded list might be an older server version. Neither the
          // browser copy nor the current list can safely win automatically.
          active.conflictedSceneIds.add(scene.id);
        }
        if (active.conflictedSceneIds.has(scene.id)) continue;
        if (!active.initialized && shots.length === 0 && saved?.length) {
          active.pendingRestores.set(scene.id, shotSignature);
          current.onRestore(scene.id, saved);
          restored = true;
          continue;
        }
        // Keep the saved version while React applies a requested restore.
        // A later actual edit to the current list remains the newest value.
        if (active.pendingRestores.get(scene.id) === shotSignature) continue;
        active.pendingRestores.delete(scene.id);
        active.draft.scenes[scene.id] = shots;
      }
      // A removed scene is no longer authorized by the loaded workspace.
      for (const sceneId of Object.keys(active.draft.scenes)) {
        if (!(sceneId in normalized)) {
          delete active.draft.scenes[sceneId];
          active.conflictedSceneIds.delete(sceneId);
          active.pendingRestores.delete(sceneId);
        }
      }
      active.initialized = true;
      if (signature === active.signature && !restored) return;
      if (!Object.values(active.draft.scenes).some((shots) => shots.length) && !active.hadDraft) return;
      active.draft.updatedAt = new Date().toISOString();
      writeTemporaryDraft(active.draft);
      active.hadDraft = true;
      active.signature = signature;
      setStatus(active.conflictedSceneIds.size ? 'conflict' : restored ? 'restored' : 'saved');
    } catch {
      setStatus('unavailable');
    }
  };

  useEffect(() => {
    let cancelled = false;
    session.current = null;
    setStatus(authPaused.current ? 'paused' : null);
    const invalidate = () => {
      cancelled = true;
      authPaused.current = true;
      session.current = null;
      setStatus('paused');
    };
    const handleStorage = (event: StorageEvent) => {
      // Only the key name is observed; credentials are never read or copied.
      if (event.key === null || event.key === 'authToken' || event.key === 'authRefreshToken') {
        invalidate();
      }
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, invalidate);
    // Another tab can log out or switch account while this workspace stays
    // mounted. Do not keep saving the former account's scenes after that.
    window.addEventListener('storage', handleStorage);
    if (!authPaused.current && enabled && projectId && !loading && !loadError) {
      const initialize = async () => {
        try {
          const profile = await fetchProfileMe();
          if (cancelled || authPaused.current) return;
          const userId = profile.user.id;
          if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error('Invalid profile');
          let saved: Draft | null = null;
          try {
            saved = readTemporaryDraft(userId, projectId);
          } catch {
            // A current in-memory result remains saveable even if an earlier
            // stored copy was malformed. Storage denial is reported on write.
            setStatus('unavailable');
          }
          session.current = {
            conflictedSceneIds: new Set(),
            draft: saved ?? {version: 1, projectId, userId, updatedAt: '', scenes: {}},
            hadDraft: saved !== null,
            initialized: false,
            pendingRestores: new Map(),
          };
          synchronize.current();
        } catch {
          if (!cancelled) setStatus('unavailable');
        }
      };
      void initialize();
    }
    return () => {
      cancelled = true;
      session.current = null;
      window.removeEventListener(AUTH_EXPIRED_EVENT, invalidate);
      window.removeEventListener('storage', handleStorage);
    };
  }, [enabled, loadError, loading, projectId]);

  useEffect(() => {
    synchronize.current();
  }, [scenes]);

  const resolveConflict = (restoreSaved: boolean) => {
    const active = session.current;
    const current = latest.current;
    if (!active || authPaused.current || !current.enabled || current.loading || current.loadError) return;
    try {
      for (const scene of current.scenes) {
        if (!active.conflictedSceneIds.has(scene.id)) continue;
        const shots = normalizeTemporaryShots(scene.shots, scene.id);
        if (!shots) throw new Error('Invalid storyboard draft');
        if (restoreSaved) {
          active.pendingRestores.set(scene.id, JSON.stringify(shots));
          current.onRestore(scene.id, active.draft.scenes[scene.id]);
        } else {
          active.draft.scenes[scene.id] = shots;
        }
      }
      active.conflictedSceneIds.clear();
      active.signature = undefined;
      synchronize.current();
    } catch {
      setStatus('unavailable');
    }
  };

  const remove = () => {
    const active = session.current;
    if (!active) return;
    try {
      removeTemporaryDraft(active.draft.userId, projectId);
      active.suspendedSignature = JSON.stringify(Object.fromEntries(
        latest.current.scenes.map((scene) => [scene.id, normalizeTemporaryShots(scene.shots, scene.id)]),
      ));
      active.signature = undefined;
      active.draft.scenes = {};
      active.conflictedSceneIds.clear();
      active.pendingRestores.clear();
      setStatus('removed');
    } catch {
      setStatus('unavailable');
    }
  };

  const exportDraft = () => {
    try {
      // Export remains available when profile lookup or localStorage fails.
      // Scene access was already checked by the workspace loader.
      const data = {
        version: 1,
        projectId,
        updatedAt: new Date().toISOString(),
        scenes: Object.fromEntries(latest.current.scenes.map((scene) => [
          scene.id, normalizeTemporaryShots(scene.shots, scene.id) ?? [],
        ])),
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
      const link = document.createElement('a');
      link.href = url;
      link.download = `storyboard-project-${projectId}-temporary.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setStatus('unavailable');
    }
  };

  if (!enabled || loading || loadError || !status) return null;
  return (
    <div className="storyboard-temporary-draft">
      <span role="status">{t(`storyboard.temporaryDraft.${status}`)}</span>
      {Boolean(session.current?.conflictedSceneIds.size) && (
        <>
          <Button onClick={() => resolveConflict(true)} size="small">
            {t('storyboard.temporaryDraft.restoreConflict')}
          </Button>
          <Button onClick={() => resolveConflict(false)} size="small">
            {t('storyboard.temporaryDraft.keepCurrent')}
          </Button>
        </>
      )}
      {scenes.some((scene) => scene.shots.length > 0) && (
        <Button onClick={exportDraft} size="small" type="text">
          {t('storyboard.temporaryDraft.export')}
        </Button>
      )}
      {session.current && status !== 'removed' && (
        <Button onClick={remove} size="small" type="text">
          {t('storyboard.temporaryDraft.remove')}
        </Button>
      )}
    </div>
  );
}
