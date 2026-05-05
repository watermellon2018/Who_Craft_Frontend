import React, {useState} from 'react';
import {Empty} from 'antd';
import {useNavigate, useParams} from 'react-router-dom';
import HeaderComponent from '../../../page/main/header';
import CharacterTreeSidebar from './CharacterTreeSidebar';
import {useProjectIdFromRoute} from '../hooks/useProjectIdFromRoute';

export default function CharacterStudioShell({children}: {children: React.ReactNode}) {
  const navigate = useNavigate();
  const {characterId} = useParams();
  const projectId = useProjectIdFromRoute();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isEditorRoute = Boolean(characterId);

  if (!projectId) {
    return (
      <>
        <HeaderComponent />
        <div style={{minHeight: '100vh', background: '#1b1d22', padding: 24}}>
          <Empty description="Не выбран проект" />
        </div>
      </>
    );
  }

  return (
    <>
      <HeaderComponent />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: sidebarCollapsed ? '58px minmax(0, 1fr)' : '280px minmax(0, 1fr)',
          height: isEditorRoute ? 'calc(100vh - 64px)' : 'auto',
          minHeight: 'calc(100vh - 64px)',
          background: '#1b1d22',
          transition: 'grid-template-columns 180ms ease',
          overflow: isEditorRoute ? 'hidden' : 'visible',
        }}
      >
        <CharacterTreeSidebar
          projectId={projectId}
          selectedCharacterId={characterId}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
          onSelectCharacter={(id) => navigate(`/project/${projectId}/characters/${id}/edit`)}
          onCreateCharacter={(name, treeNodeId) => navigate(`/project/${projectId}/characters/create`, {state: {initialCharacterName: name, sourceTreeNodeId: treeNodeId}})}
          onDeletedCharacter={(id) => {
            if (id === characterId) {
              navigate(`/project/${projectId}/characters`, {replace: true});
            }
          }}
        />
        <main
          className={isEditorRoute ? 'character-studio-shell-main character-studio-shell-main--editor custom-scrollbar' : 'character-studio-shell-main'}
          style={{minWidth: 0, minHeight: 0, overflow: isEditorRoute ? 'hidden' : 'visible'}}
        >
          {children}
        </main>
      </div>
    </>
  );
}
