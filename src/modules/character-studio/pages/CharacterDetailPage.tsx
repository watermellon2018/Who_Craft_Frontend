import React from 'react';
import {Button, Descriptions, List} from 'antd';
import {useNavigate, useParams} from 'react-router-dom';
import {useCharacter} from '../hooks/useCharacter';
import {roleLabelMap} from '../components/create/characterCreateOptions';

export default function CharacterDetailPage() {
  const {projectId = '', characterId = ''} = useParams();
  const navigate = useNavigate();
  const {character} = useCharacter(projectId, characterId);
  if (!character) return null;
  return <div style={{padding: 24, minHeight: '100vh', background: '#1b1d22'}}>
    <Button type="primary" onClick={() => navigate(`/project/${projectId}/characters/${characterId}/edit`)}>Open Editor</Button>
    <Descriptions title={character.name} bordered style={{marginTop: 20}}>
      <Descriptions.Item label="Роль">{character.role ? (roleLabelMap[character.role] ?? character.role) : '—'}</Descriptions.Item>
      <Descriptions.Item label="Identity locked">{String(character.identity_locked)}</Descriptions.Item>
      <Descriptions.Item label="Style">{character.visual_style}</Descriptions.Item>
      <Descriptions.Item label="Age">{character.age}</Descriptions.Item>
      <Descriptions.Item label="Gender">{character.gender}</Descriptions.Item>
    </Descriptions>
    <List header="Outfits" dataSource={character.outfits || []} renderItem={(outfit) => <List.Item>{outfit.name}</List.Item>} />
  </div>;
}
