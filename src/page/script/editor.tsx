import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  CloseOutlined,
  DownloadOutlined,
  FileTextOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import WCraftBrand from '../../components/WCraftBrand';

import {useProjectIdFromRoute} from '../../modules/character-studio/hooks/useProjectIdFromRoute';
import PathConstants, {
  projectDashboardPath,
} from '../../routes/pathConstant';
import {useUnsavedChangesGuard} from '../../utils/useUnsavedChangesGuard';
import {sceneToPlainText} from './api';
import CardsView from './CardsView';
import CharactersView from './CharactersView';
import {canBypassUnsavedChangesAfterSelectedSceneSave} from './navigation';
import ScreenplayView from './ScreenplayView';
import './style.css';
import type {WorkspaceMode} from './types';
import {useScriptWorkspace} from './useScriptWorkspace';

const MODE_ITEMS: Array<{mode: WorkspaceMode; label: string; icon: React.ReactNode}> = [
  {mode: 'screenplay', label: 'Сценарий', icon: <FileTextOutlined />},
  {mode: 'cards', label: 'Карточки', icon: <AppstoreOutlined />},
  {mode: 'characters', label: 'Персонажи', icon: <TeamOutlined />},
];

export default function ScriptPage() {
  const projectId = useProjectIdFromRoute();
  const navigate = useNavigate();
  const workspace = useScriptWorkspace(projectId);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 780,
  );
  const {allowNextNavigation} = useUnsavedChangesGuard(
    workspace.dirtySceneIds.length > 0,
  );

  const exportScript = () => {
    const content = workspace.scenes.map(sceneToPlainText).join('\n\n\n');
    const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${workspace.project?.title || 'script'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const finish = async () => {
    const saved = await workspace.saveSelectedScene();
    if (!saved || !projectId) return;
    if (canBypassUnsavedChangesAfterSelectedSceneSave(
      workspace.dirtySceneIds,
      workspace.selectedScene?.id,
    )) {
      allowNextNavigation();
    }
    navigate(projectDashboardPath(projectId));
  };

  const deleteScene = (sceneId: number) => {
    if (window.confirm('Удалить эту сцену? Это действие нельзя отменить.')) {
      void workspace.removeScene(sceneId);
    }
  };

  if (!projectId) {
    return <div className="script-state-page">
      <FileTextOutlined />
      <h1>Не выбран проект</h1>
      <p>Откройте сценарий из панели нужного проекта.</p>
      <button className="script-button script-button--primary" onClick={() => navigate(PathConstants.PROJECTS)}>
        Все проекты
      </button>
    </div>;
  }

  if (workspace.loading && !workspace.project) {
    return <div className="script-state-page">
      <span className="script-loader" />
      <h1>Открываем сценарий</h1>
      <p>Загружаем сцены и персонажей проекта.</p>
    </div>;
  }

  if (workspace.error || !workspace.project) {
    return <div className="script-state-page script-state-page--error">
      <FileTextOutlined />
      <h1>Сценарий недоступен</h1>
      <p>{workspace.error || 'Данные проекта не получены.'}</p>
      <button className="script-button script-button--primary" onClick={() => void workspace.reload()}>
        <ReloadOutlined /> Повторить
      </button>
    </div>;
  }

  const selectedDirty = Boolean(
    workspace.selectedScene && workspace.dirtySceneIds.includes(workspace.selectedScene.id),
  );
  const selectedSaving = Boolean(
    workspace.selectedScene && workspace.savingSceneIds.includes(workspace.selectedScene.id),
  );
  const selectedScenePosition = workspace.selectedScene
    ? workspace.scenes.findIndex((scene) => scene.id === workspace.selectedScene?.id) + 1
    : 0;
  const saveStatus = workspace.canEdit
    ? selectedSaving ? 'Сохраняем…' : selectedDirty ? 'Есть изменения' : 'Сохранено'
    : 'Только просмотр';
  const canRetrySave = workspace.saveError?.includes('сохранить') === true;

  return <div className={`script-workspace${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
    <header className="script-topbar">
      <WCraftBrand className="script-topbar__brand" />
      <div className="script-project-heading">
        <div>
          <button onClick={() => navigate(PathConstants.PROJECTS)}>Все проекты</button>
          <span>/</span>
          <span>Сценарий</span>
        </div>
        <h1>{workspace.project.title}</h1>
        <small
          aria-live="polite"
          className={!selectedDirty && !selectedSaving && workspace.canEdit ? 'is-saved' : ''}
        >{saveStatus}</small>
      </div>
      <div className="script-topbar__actions">
        <button className="script-button" disabled={workspace.scenes.length === 0} onClick={exportScript}>
          <DownloadOutlined /> Экспорт
        </button>
        <button className="script-button script-button--primary" onClick={() => void finish()}>
          <ArrowLeftOutlined /> К проекту
        </button>
      </div>
    </header>

    <aside className="script-rail" aria-label="Навигация по сценарию">
      <div className="script-rail__header">
        {!sidebarCollapsed && <strong>Рабочая область</strong>}
        <button
          aria-label={sidebarCollapsed ? 'Развернуть боковую панель' : 'Свернуть боковую панель'}
          aria-expanded={!sidebarCollapsed}
          title={sidebarCollapsed ? 'Развернуть панель' : 'Свернуть панель'}
          onClick={() => setSidebarCollapsed((current) => !current)}
        >{sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}</button>
      </div>

      <nav className="script-rail__modes" aria-label="Разделы сценария">
        {MODE_ITEMS.map((item) => (
          <button
            key={item.mode}
            aria-current={workspace.mode === item.mode ? 'page' : undefined}
            aria-label={item.label}
            className={workspace.mode === item.mode ? 'is-active' : ''}
            title={item.label}
            onClick={() => void workspace.changeMode(item.mode)}
          >
            {item.icon}
            {!sidebarCollapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {workspace.mode === 'screenplay' && !sidebarCollapsed && <section className="script-scene-list">
        <div className="script-scene-list__header">
          <div>
            <span className="script-eyebrow">СТРУКТУРА</span>
            <h2>Сцены</h2>
          </div>
          {workspace.canEdit && <button aria-label="Добавить сцену" onClick={() => void workspace.addScene()}>
            <PlusOutlined />
          </button>}
        </div>
        <div className="script-scene-list__items">
          {workspace.scenes.map((scene) => <button
            key={scene.id}
            aria-current={workspace.selectedScene?.id === scene.id ? 'true' : undefined}
            className={workspace.selectedScene?.id === scene.id ? 'is-selected' : ''}
            onClick={() => void workspace.selectScene(scene.id)}
          >
            <span>{scene.order}</span>
            <span>
              <strong>{scene.title || 'Без названия'}</strong>
              <small>Акт {scene.act}</small>
            </span>
          </button>)}
        </div>
      </section>}
    </aside>

    <div className="script-main">
      {workspace.mode === 'cards' && <section className="script-stats">
        <div><strong>{workspace.stats.sceneCount}</strong><span>сцен</span></div>
        {workspace.stats.acts.map((act) => {
          const percent = workspace.stats.sceneCount
            ? Math.round(act.sceneCount / workspace.stats.sceneCount * 100)
            : 0;
          return <div key={act.act} className={`script-act-stat script-act-stat--${act.act}`}>
            <span>АКТ {act.act}</span>
            <i><b style={{width: `${percent}%`}} /></i>
            <small>{percent}% · {act.sceneCount} сцен</small>
          </div>;
        })}
        {workspace.canEdit && <button className="script-add-scene" onClick={() => void workspace.addScene()}>
          <PlusOutlined /> Добавить сцену
        </button>}
      </section>}

      {(workspace.conflict || workspace.saveError) && <div className="script-alert" role="alert">
        <span>{workspace.conflict?.message || workspace.saveError}</span>
        <button onClick={() => {
          if (workspace.conflict) void workspace.reload();
          else if (canRetrySave) void workspace.saveSelectedScene();
          else workspace.dismissSaveError();
        }}>{workspace.conflict || canRetrySave ? <ReloadOutlined /> : <CloseOutlined />} {
          workspace.conflict ? 'Перезагрузить' : canRetrySave ? 'Повторить сохранение' : 'Закрыть'
        }</button>
      </div>}

      <section className="script-workspace__content">
        {workspace.mode === 'cards' && <CardsView
          scenes={workspace.scenes}
          selectedScene={workspace.selectedScene}
          characterFilter={workspace.characterSceneFilter}
          canEdit={workspace.canEdit}
          dirtySceneIds={workspace.dirtySceneIds}
          savingSceneIds={workspace.savingSceneIds}
          onAdd={() => void workspace.addScene()}
          onChange={workspace.updateScene}
          onClearFilter={() => workspace.setCharacterSceneFilter(null)}
          onDelete={deleteScene}
          onOpenScreenplay={() => void workspace.changeMode('screenplay')}
          onSave={() => void workspace.saveSelectedScene()}
          onSelect={(sceneId) => void workspace.selectScene(sceneId)}
        />}
        {workspace.mode === 'screenplay' && <ScreenplayView
          characters={workspace.characters}
          selectedScene={workspace.selectedScene}
          sceneCount={workspace.scenes.length}
          scenePosition={selectedScenePosition}
          canEdit={workspace.canEdit}
          dirtySceneIds={workspace.dirtySceneIds}
          savingSceneIds={workspace.savingSceneIds}
          onAddScene={() => void workspace.addScene()}
          onChange={workspace.updateScene}
          onDeleteScene={deleteScene}
          onSave={() => void workspace.saveSelectedScene()}
        />}
        {workspace.mode === 'characters' && <CharactersView characters={workspace.characters} />}
      </section>
    </div>
  </div>;
}
