import React, {useEffect, useState} from 'react';
import {Alert, Button, Empty, Input, Modal, Spin, message} from 'antd';
import {PlusOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';
import {characterCreatePath, characterVariantsPath} from '../../../routes/pathConstant';
import {characterApi} from '../api/characterApi';
import CharacterCard from '../components/CharacterCard';
import {CHARACTER_LIST_UPDATED_EVENT, notifyCharacterListUpdated, notifyCharacterTreeUpdated} from '../events';
import {useCharacters} from '../hooks/useCharacters';
import {useProjectIdFromRoute} from '../hooks/useProjectIdFromRoute';
import type {StudioCharacter} from '../types/character.types';
import './CharacterGalleryPage.css';

const INITIAL_VARIANT_JOB_TYPES = new Set(['initial_variants', 'reference_variants']);

export default function CharacterGalleryPage() {
  const navigate = useNavigate();
  const {t} = useTranslation();
  const projectId = useProjectIdFromRoute();
  const [search, setSearch] = useState('');
  const [resumingDraftId, setResumingDraftId] = useState<string | null>(null);
  const {characters, loading, error, refresh} = useCharacters(projectId, {
    include_drafts: true,
    search,
  });

  useEffect(() => {
    window.addEventListener(CHARACTER_LIST_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(CHARACTER_LIST_UPDATED_EVENT, refresh);
  }, [refresh]);

  const deleteCharacter = (character: StudioCharacter) => {
    const isDraft = character.status === 'draft';
    Modal.confirm({
      title: t(isDraft
        ? 'characterStudio.gallery.deleteDraftConfirmTitle'
        : 'characterStudio.gallery.deleteConfirmTitle'),
      content: t(isDraft
        ? 'characterStudio.gallery.deleteDraftConfirmContent'
        : 'characterStudio.gallery.deleteConfirmContent'),
      okText: t('common.delete'),
      okButtonProps: {danger: true},
      cancelText: t('common.cancel'),
      async onOk() {
        try {
          await characterApi.delete(projectId, character.character_id);
          notifyCharacterListUpdated();
          notifyCharacterTreeUpdated();
          await refresh();
          message.success(t(isDraft
            ? 'characterStudio.gallery.deleteDraftSuccess'
            : 'characterStudio.gallery.deleteSuccess'));
        } catch {
          message.error(t(isDraft
            ? 'characterStudio.gallery.deleteDraftError'
            : 'characterStudio.gallery.deleteError'));
        }
      },
    });
  };

  const resumeDraft = async (character: StudioCharacter) => {
    if (resumingDraftId) return;
    setResumingDraftId(character.character_id);
    try {
      const response = await characterApi.listGenerationJobs(projectId, character.character_id);
      const latestInitialJob = (response.data.jobs ?? []).find(
        (job) => !job.job_type || INITIAL_VARIANT_JOB_TYPES.has(job.job_type),
      );
      if (latestInitialJob) {
        navigate(characterVariantsPath(
          projectId,
          character.character_id,
          latestInitialJob.job_id,
        ), {state: {characterName: character.name}});
        return;
      }
      navigate(characterCreatePath(projectId, {draftId: character.character_id}), {
        state: {characterId: character.character_id, initialCharacterName: character.name},
      });
    } catch {
      message.error(t('characterStudio.gallery.resumeDraftError'));
    } finally {
      setResumingDraftId(null);
    }
  };

  const goCreate = () => navigate(`/project/${projectId}/characters/create`);
  const isInitialLoad = loading && characters.length === 0;
  const hasResults = characters.length > 0;
  const isSearching = search.trim().length > 0;
  const drafts = characters.filter((character) => character.status === 'draft');
  const visibleCharacters = characters.filter((character) => character.status !== 'draft');

  return <div className="character-gallery-page" style={{padding: 24, minHeight: '100vh', background: '#1b1d22'}}>
    <div className="character-gallery-page__toolbar">
      <Input.Search
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t('characterStudio.gallery.searchPlaceholder')}
        className="character-gallery-page__search"
        aria-label={t('characterStudio.gallery.searchPlaceholder')}
      />
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={goCreate}
        className="character-gallery-page__create"
      >
        {t('characterStudio.gallery.createCharacter')}
      </Button>
    </div>

    {error && (
      <Alert
        type="error"
        showIcon
        message={error}
        action={<Button size="small" onClick={refresh}>{t('common.retry')}</Button>}
        style={{marginBottom: 16}}
      />
    )}

    {isInitialLoad ? (
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '48px 0'}}>
        <Spin aria-label={t('characterStudio.gallery.loadingTip')} />
        <span style={{color: 'rgba(255,255,255,0.65)'}}>
          {t('characterStudio.gallery.loadingTip')}
        </span>
      </div>
    ) : !hasResults && !error ? (
      <Empty
        description={
          <span style={{color: 'rgba(255,255,255,0.65)'}}>
            {isSearching
              ? t('characterStudio.gallery.noResults', {query: search})
              : t('characterStudio.gallery.emptyTitle')}
          </span>
        }
        style={{padding: '48px 0'}}
      >
        {!isSearching && (
          <Button type="primary" icon={<PlusOutlined />} onClick={goCreate}>
            {t('characterStudio.gallery.emptyCta')}
          </Button>
        )}
      </Empty>
    ) : (
      <div className="character-gallery-page__sections">
        {drafts.length > 0 && (
          <section className="character-gallery-page__section" aria-labelledby="character-drafts-title">
            <div className="character-gallery-page__section-heading">
              <h2 id="character-drafts-title">{t('characterStudio.gallery.draftsTitle')}</h2>
              <p>{t('characterStudio.gallery.draftsDescription')}</p>
            </div>
            <div className="character-gallery-page__grid">
              {drafts.map((character) => (
                <CharacterCard
                  busy={resumingDraftId === character.character_id}
                  key={character.character_id}
                  character={character}
                  onEdit={() => void resumeDraft(character)}
                  onDelete={() => deleteCharacter(character)}
                />
              ))}
            </div>
          </section>
        )}
        {visibleCharacters.length > 0 && (
          <section className="character-gallery-page__section" aria-label={t('characterStudio.breadcrumbs.characters')}>
            <div className="character-gallery-page__grid">
              {visibleCharacters.map((character) => (
                <CharacterCard
                  key={character.character_id}
                  character={character}
                  onEdit={() => navigate(`/project/${projectId}/characters/${character.character_id}/edit`)}
                  onDelete={() => deleteCharacter(character)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    )}
  </div>;
}
