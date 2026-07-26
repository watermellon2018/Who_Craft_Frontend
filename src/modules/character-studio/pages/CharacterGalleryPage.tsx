import React, {useEffect, useState} from 'react';
import {Alert, Button, Empty, Input, Modal, Spin, message} from 'antd';
import {PlusOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';
import {characterApi} from '../api/characterApi';
import CharacterCard from '../components/CharacterCard';
import {CHARACTER_LIST_UPDATED_EVENT, notifyCharacterListUpdated, notifyCharacterTreeUpdated} from '../events';
import {useCharacters} from '../hooks/useCharacters';
import {useProjectIdFromRoute} from '../hooks/useProjectIdFromRoute';
import './CharacterGalleryPage.css';

export default function CharacterGalleryPage() {
  const navigate = useNavigate();
  const {t} = useTranslation();
  const projectId = useProjectIdFromRoute();
  const [search, setSearch] = useState('');
  // No status filter: the backend default returns only visible characters
  // (i.e. hides drafts) which is exactly what the gallery should show.
  const {characters, loading, error, refresh} = useCharacters(projectId, {search});

  useEffect(() => {
    window.addEventListener(CHARACTER_LIST_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(CHARACTER_LIST_UPDATED_EVENT, refresh);
  }, [refresh]);

  const deleteCharacter = (characterId: string) => {
    Modal.confirm({
      title: t('characterStudio.gallery.deleteConfirmTitle'),
      content: t('characterStudio.gallery.deleteConfirmContent'),
      okText: t('common.delete'),
      okButtonProps: {danger: true},
      cancelText: t('common.cancel'),
      async onOk() {
        try {
          await characterApi.delete(projectId, characterId);
          notifyCharacterListUpdated();
          notifyCharacterTreeUpdated();
          await refresh();
          message.success(t('characterStudio.gallery.deleteSuccess'));
        } catch {
          message.error(t('characterStudio.gallery.deleteError'));
        }
      },
    });
  };

  const goCreate = () => navigate(`/project/${projectId}/characters/create`);
  const isInitialLoad = loading && characters.length === 0;
  const hasResults = characters.length > 0;
  const isSearching = search.trim().length > 0;

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
      <div style={{display: 'flex', justifyContent: 'center', padding: '48px 0'}}>
        <Spin tip={t('characterStudio.gallery.loadingTip')} />
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
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16}}>
        {characters.map((character) => (
          <CharacterCard
            key={character.character_id}
            character={character}
            onEdit={() => navigate(`/project/${projectId}/characters/${character.character_id}/edit`)}
            onDelete={() => deleteCharacter(character.character_id)}
          />
        ))}
      </div>
    )}
  </div>;
}
