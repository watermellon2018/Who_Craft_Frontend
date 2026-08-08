import React, {useEffect, useMemo, useState} from 'react';
import {message} from 'antd';
import {useTranslation} from 'react-i18next';
import {useNavigate, useParams} from 'react-router-dom';
import ReferencesTopBar from '../components/references/ReferencesTopBar';
import ReferencePreviewPanel from '../components/references/ReferencePreviewPanel';
import ReferenceCardGrid from '../components/references/ReferenceCardGrid';
import ReferenceRightPanel from '../components/references/ReferenceChecklistPanel';
import {
  canProceedTo3DFromReferences,
  getRequiredReferencesProgress,
} from '../components/references/referenceReadiness';
import {
  CompareReferenceModal,
  FullscreenReferenceModal,
  ReferenceCorrectionModal,
  ReferenceUploadModal,
} from '../components/references/ReferenceModals';
import {useProjectIdFromRoute} from '../hooks/useProjectIdFromRoute';
import {useCharacterReferences} from '../hooks/useCharacterReferences';
import {
  CharacterReference,
  REFERENCE_TYPE_ORDER,
  ReferencesChecklist,
  ReferenceType,
} from '../types/character.types';
import './CharacterReferencesPage.css';
import '../pages/CharacterEditorPage.css';

function pickInitialSelection(state: ReturnType<typeof useCharacterReferences>['state']): ReferenceType {
  if (!state) return 'portrait';
  if (state.primary_reference_id) {
    const primary = state.references.find((row) => row.asset_id === state.primary_reference_id);
    if (primary) return primary.reference_type;
  }
  const portrait = state.references.find((row) => row.reference_type === 'portrait');
  if (portrait && portrait.status === 'ready') return 'portrait';
  const firstReady = state.references.find((row) => row.status === 'ready');
  if (firstReady) return firstReady.reference_type;
  return 'portrait';
}

const EMPTY_CHECKLIST: ReferencesChecklist = {
  appearance_stable: false,
  face_matches_base: false,
  outfit_readable: false,
  full_body_ready: false,
  front_side_back_ready: false,
  suitable_for_3d: false,
};

const CharacterReferencesPage: React.FC = () => {
  const navigate = useNavigate();
  const {t} = useTranslation();
  const params = useParams();
  const projectId = useProjectIdFromRoute();
  const characterId = String(params.characterId || '');
  const refs = useCharacterReferences(projectId, characterId);

  const [selectedType, setSelectedType] = useState<ReferenceType>('portrait');
  const [hasInitialized, setHasInitialized] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [proceedLoading, setProceedLoading] = useState(false);

  // First-load: pick a sensible default reference. Subsequent refreshes must
  // NOT clobber the user's selection (regenerate / correction / upload all
  // refresh state but the user is still looking at the same card).
  useEffect(() => {
    if (!hasInitialized && refs.state) {
      setSelectedType(pickInitialSelection(refs.state));
      setHasInitialized(true);
    }
  }, [refs.state, hasInitialized]);

  const referencesList: CharacterReference[] = refs.state?.references
    || REFERENCE_TYPE_ORDER.map((reference_type) => ({
      reference_type,
      status: 'missing',
      asset_id: null,
      image_url: null,
      is_primary: false,
      version: 0,
      source: null,
    }));

  const selected: CharacterReference = useMemo(() => {
    return (
      referencesList.find((row) => row.reference_type === selectedType) || {
        reference_type: selectedType,
        status: 'missing',
        asset_id: null,
        image_url: null,
        is_primary: false,
        version: 0,
        source: null,
      }
    );
  }, [referencesList, selectedType]);

  const primary: CharacterReference | null = useMemo(() => {
    const state = refs.state;
    if (!state) return null;
    if (state.primary_reference_id) {
      const found = state.references.find((row) => row.asset_id === state.primary_reference_id);
      if (found) return found;
    }
    return state.references.find((row) => row.reference_type === 'portrait' && row.status === 'ready') || null;
  }, [refs.state]);

  const handleDownload = async () => {
    if (!selected.image_url) return;
    // Browsers ignore the `download` attribute when the href points to a
    // different origin (CRA dev runs on :3000, MEDIA on :8000), so a plain
    // <a download> just opens the file in a new tab. Fetch as a blob and
    // hand a same-origin object URL to the synthetic <a>.
    try {
      const response = await fetch(selected.image_url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const ext = (selected.image_url.split('.').pop() || 'png').split('?')[0];
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `character_${characterId}_${selected.reference_type}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Defer revoke so Chrome/Firefox finish kicking off the download.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (_) {
      message.error(t('characterStudio.references.downloadError'));
    }
  };

  const handleRegenerate = async () => {
    await refs.generate(selectedType);
  };

  const handleCorrectSubmit = async (prompt: string) => {
    if (!selected.asset_id) {
      message.error(t('characterStudio.references.angleNotReady'));
      return;
    }
    await refs.correct(selected.asset_id, prompt, selectedType);
  };

  const handleUpload = async (file: File) => {
    const result = await refs.upload(selectedType, file);
    if (result) message.success(t('characterStudio.references.uploadSuccess'));
  };

  const handleMakePrimary = async () => {
    if (!selected.asset_id) {
      message.error(t('characterStudio.references.needToGenerate'));
      return;
    }
    await refs.makePrimary(selected.asset_id);
    message.success(t('characterStudio.references.primaryUpdated'));
  };

  const handleChecklistChange = (patch: Partial<ReferencesChecklist>) => {
    refs.updateChecklist(patch);
  };

  const handleProceed = async () => {
    setProceedLoading(true);
    try {
      const result = await refs.proceedTo3D();
      if (!result) return;
      if (!result.can_proceed) {
        message.error(t('characterStudio.references.proceedBlocked'));
        await refs.refresh();
        return;
      }
      const target = result.next_url || `/project/${projectId}/characters/${characterId}/3d-model`;
      message.success(t('characterStudio.references.locked'));
      navigate(target);
    } finally {
      setProceedLoading(false);
    }
  };

  const isSelectedGenerating = selected.status === 'generating' || Boolean(refs.activeJobs[selectedType]);

  const requiredProgress = useMemo(
    () => getRequiredReferencesProgress(referencesList),
    [referencesList],
  );

  if (!characterId) {
    return <div className="references-empty">{t('characterStudio.references.cannotDetermine')}</div>;
  }

  const characterName = refs.state?.character.name || 'Персонаж';
  const identityLocked = Boolean(refs.state?.character.identity_locked);
  const checklist = refs.state?.checklist || EMPTY_CHECKLIST;
  const canProceed = canProceedTo3DFromReferences({
    references: referencesList,
    checklist,
    activeJobs: refs.activeJobs,
    autoGenerationActive: refs.autoGenerationActive,
    serverAllowsProceed: Boolean(refs.state?.can_proceed_to_3d),
  });
  const blockers = refs.state?.proceed_blockers || [];

  return (
    <div className="character-editor character-references-shell">
      <div className="character-editor__topbar references-topbar-grid">
        <ReferencesTopBar
          characterName={characterName}
          onBack={() => navigate(`/project/${projectId}/characters/${characterId}/edit`)}
          onSave={() => message.info(t('characterStudio.references.autoSave'))}
          saving={false}
          onProceed={handleProceed}
          proceedDisabled={!canProceed || proceedLoading}
          proceedLoading={proceedLoading}
          onMenuAction={(key) => {
            if (key === 'back-to-editor') {
              navigate(`/project/${projectId}/characters/${characterId}/edit`);
            }
          }}
        />
      </div>

      <div className="character-editor__workspace">
        <aside className="character-editor__categories custom-scrollbar">
          {refs.error && <div className="references-error">{refs.error}</div>}
          <ReferenceCardGrid
            references={referencesList}
            selectedType={selectedType}
            onSelect={setSelectedType}
          />
        </aside>

        <main className="character-editor__canvas">
          <div className="character-editor-center">
            <ReferencePreviewPanel
              reference={selected}
              identityLocked={identityLocked}
              autoGenerationActive={refs.autoGenerationActive}
              requiredReadyCount={requiredProgress.ready}
              requiredTotal={requiredProgress.total}
              onDownload={handleDownload}
              onOpen={() => setFullscreenOpen(true)}
              onCompare={() => setCompareOpen(true)}
              onGenerate={handleRegenerate}
              onUpload={() => setUploadOpen(true)}
              onRetry={handleRegenerate}
            />
          </div>
        </main>

        <section className="character-editor__settings custom-scrollbar">
          <ReferenceRightPanel
            references={referencesList}
            selected={selected}
            checklist={checklist}
            onChecklistChange={handleChecklistChange}
            blockers={blockers}
            canProceed={canProceed}
            isGenerating={isSelectedGenerating}
            autoGenerationActive={refs.autoGenerationActive}
            onRegenerate={handleRegenerate}
            onCorrect={() => setCorrectionOpen(true)}
            onUpload={() => setUploadOpen(true)}
            onMakePrimary={handleMakePrimary}
            onBackToEditor={() => navigate(`/project/${projectId}/characters/${characterId}/edit`)}
          />
        </section>
      </div>

      <ReferenceCorrectionModal
        open={correctionOpen}
        reference={selected}
        onCancel={() => setCorrectionOpen(false)}
        onSubmit={handleCorrectSubmit}
      />
      <ReferenceUploadModal
        open={uploadOpen}
        referenceType={selectedType}
        onCancel={() => setUploadOpen(false)}
        onUpload={handleUpload}
      />
      <CompareReferenceModal
        open={compareOpen}
        primary={primary}
        selected={selected}
        onCancel={() => setCompareOpen(false)}
      />
      <FullscreenReferenceModal
        open={fullscreenOpen}
        reference={selected}
        onCancel={() => setFullscreenOpen(false)}
      />
    </div>
  );
};

export default CharacterReferencesPage;
