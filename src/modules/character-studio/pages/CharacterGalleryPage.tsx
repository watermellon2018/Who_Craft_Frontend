import React, {useEffect, useState} from 'react';
import {Button, Input, Modal, Spin, message} from 'antd';
import {PlusOutlined} from '@ant-design/icons';
import {useNavigate} from 'react-router-dom';
import {characterApi} from '../api/characterApi';
import CharacterCard from '../components/CharacterCard';
import {CHARACTER_LIST_UPDATED_EVENT, notifyCharacterListUpdated, notifyCharacterTreeUpdated} from '../events';
import {useCharacters} from '../hooks/useCharacters';
import {useProjectIdFromRoute} from '../hooks/useProjectIdFromRoute';

export default function CharacterGalleryPage() {
  const navigate = useNavigate();
  const projectId = useProjectIdFromRoute();
  const [search, setSearch] = useState('');
  const {characters, loading, refresh} = useCharacters(projectId, {search, status: 'all'});

  useEffect(() => {
    window.addEventListener(CHARACTER_LIST_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(CHARACTER_LIST_UPDATED_EVENT, refresh);
  }, [refresh]);

  const deleteCharacter = (characterId: string) => {
    Modal.confirm({
      title: 'Удалить персонажа?',
      content: 'Персонаж будет удален из списка и дерева.',
      okText: 'Удалить',
      okButtonProps: {danger: true},
      cancelText: 'Отмена',
      async onOk() {
        await characterApi.delete(projectId, characterId);
        notifyCharacterListUpdated();
        notifyCharacterTreeUpdated();
        await refresh();
        message.success('Персонаж удален');
      },
    });
  };

  return <div style={{padding: 24, minHeight: '100vh', background: '#1b1d22'}}>
    <div style={{display: 'flex', gap: 12, justifyContent: 'space-between', marginBottom: 20, alignItems: 'end'}}>
      <Input.Search value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск персонажей" style={{maxWidth: 360}} />
      <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(`/project/${projectId}/characters/create`)}>Создать персонажа</Button>
    </div>
    {loading ? <Spin /> : <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16}}>
      {characters.map((character) => (
        <CharacterCard
          key={character.character_id}
          character={character}
          onEdit={() => navigate(`/project/${projectId}/characters/${character.character_id}/edit`)}
          onDelete={() => deleteCharacter(character.character_id)}
        />
      ))}
    </div>}
  </div>;
}
