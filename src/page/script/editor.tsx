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
  ShareAltOutlined,
} from '@ant-design/icons';
import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate, useSearchParams} from 'react-router-dom';

import {useProjectIdFromRoute} from '../../modules/character-studio/hooks/useProjectIdFromRoute';
import DashboardHeader from '../../modules/profile/components/DashboardHeader';
import PathConstants, {
  characterCreatePath,
  projectDashboardPath,
} from '../../routes/pathConstant';
import {useUnsavedChangesGuard} from '../../utils/useUnsavedChangesGuard';
import {sceneToPlainText} from './api';
import CardsView from './CardsView';
import CharactersView from './CharactersView';
import MissingCharactersNotice from './MissingCharactersNotice';
import {canBypassUnsavedChangesAfterSelectedSceneSave} from './navigation';
import SceneListPanel from './SceneListPanel';
import ScreenplayView from './ScreenplayView';
import './style.css';
import type {MissingScriptCharacter, WorkspaceMode} from './types';
import {useScriptWorkspace} from './useScriptWorkspace';

const MODE_ITEMS: Array<{mode: WorkspaceMode; label: string; icon: React.ReactNode}> = [
  {mode: 'screenplay', label: 'Сценарий', icon: <FileTextOutlined />},
  {mode: 'cards', label: 'Структура', icon: <AppstoreOutlined />},
  {mode: 'characters', label: 'Связи', icon: <ShareAltOutlined />},
];

export default function ScriptPage() {
  const {t} = useTranslation();
  const projectId = useProjectIdFromRoute();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workspace = useScriptWorkspace(projectId);
  const requestedSceneId = Number(searchParams.get('sceneId')) || null;
  const openedSceneDeepLinkRef = useRef<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 780,
  );
  const [scenePanelCollapsed, setScenePanelCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= 1080,
  );
  const {allowNextNavigation} = useUnsavedChangesGuard(
    workspace.dirtySceneIds.length > 0 || workspace.reordering,
  );

  useEffect(() => {
    if (!requestedSceneId || !workspace.project) return;
    const deepLinkKey = `${projectId}:${requestedSceneId}`;
    if (openedSceneDeepLinkRef.current === deepLinkKey) return;
    if (!workspace.scenes.some(({id}) => id === requestedSceneId)) return;
    openedSceneDeepLinkRef.current = deepLinkKey;
    void workspace.openSceneInScreenplay(requestedSceneId);
  }, [projectId, requestedSceneId, workspace]);

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

  const createMissingCharacter = async (character: MissingScriptCharacter) => {
    const saved = await workspace.saveSelectedScene();
    if (!saved) return;
    if (canBypassUnsavedChangesAfterSelectedSceneSave(
      workspace.dirtySceneIds,
      workspace.selectedScene?.id,
    )) {
      allowNextNavigation();
    }
    navigate(characterCreatePath(projectId), {
      state: {initialCharacterName: character.name},
    });
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
    ? workspace.reordering
      ? 'Сохраняем порядок…'
      : selectedSaving ? 'Сохраняем…' : selectedDirty ? 'Есть изменения' : 'Сохранено'
    : 'Только просмотр';
  const saveStatusClass = workspace.reordering || selectedSaving
    ? 'is-saving'
    : selectedDirty
      ? 'is-dirty'
      : workspace.canEdit ? 'is-saved' : 'is-readonly';
  const canRetrySave = workspace.saveError?.includes('сохранить') === true;

  return <div className={`script-workspace${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
    <DashboardHeader hideSubnav />

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
        <div
          aria-label={`Статус сценария: ${saveStatus}`}
          className={`script-rail__save-status ${saveStatusClass}`}
          role="status"
          title={saveStatus}
        >
          <i aria-hidden="true" />
          {!sidebarCollapsed && <span>{saveStatus}</span>}
        </div>
        <button
          aria-label="Экспорт сценария"
          className="script-rail__action"
          disabled={workspace.scenes.length === 0}
          title="Экспорт сценария"
          onClick={exportScript}
        >
          <DownloadOutlined />
          {!sidebarCollapsed && <span>Экспорт</span>}
        </button>
        <button
          aria-label="Вернуться к проекту"
          className="script-rail__action"
          title="Вернуться к проекту"
          onClick={() => void finish()}
        >
          <ArrowLeftOutlined />
          {!sidebarCollapsed && <span>К проекту</span>}
        </button>
      </nav>

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
        {workspace.canEdit && <button
          className="script-add-scene"
          disabled={workspace.reordering}
          onClick={() => void workspace.addScene()}
        >
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

      {workspace.missingCharactersError && <div className="script-alert" role="alert">
        <span>{workspace.missingCharactersError}</span>
        <button onClick={() => void workspace.refreshMissingCharacters()}>
          <ReloadOutlined /> {t('videoPreparation.scriptNotice.retry', {
            defaultValue: 'Повторить проверку',
          })}
        </button>
      </div>}

      <MissingCharactersNotice
        canCreate={workspace.canEdit}
        characters={workspace.missingCharacters}
        onCreate={(character) => void createMissingCharacter(character)}
        projectId={projectId}
      />

      <section className="script-workspace__content">
        {workspace.mode === 'cards' && <CardsView
          scenes={workspace.scenes}
          selectedScene={workspace.selectedScene}
          characterFilter={workspace.characterSceneFilter}
          canEdit={workspace.canEdit}
          dirtySceneIds={workspace.dirtySceneIds}
          savingSceneIds={workspace.savingSceneIds}
          reordering={workspace.reordering}
          onAdd={() => void workspace.addScene()}
          onChange={workspace.updateScene}
          onClearFilter={() => workspace.setCharacterSceneFilter(null)}
          onDelete={deleteScene}
          onOpenScreenplay={(sceneId) => void workspace.openSceneInScreenplay(sceneId)}
          onReorder={workspace.reorderScenes}
          onSave={() => void workspace.saveSelectedScene()}
          onSelect={(sceneId) => void workspace.selectScene(sceneId)}
        />}
        {workspace.mode === 'screenplay' && <div
          className={`script-screenplay-shell${scenePanelCollapsed ? ' is-scenes-collapsed' : ''}`}
        >
          <ScreenplayView
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
          />
          <SceneListPanel
            canEdit={workspace.canEdit}
            collapsed={scenePanelCollapsed}
            scenes={workspace.scenes}
            selectedSceneId={workspace.selectedScene?.id ?? null}
            onAdd={() => void workspace.addScene()}
            onSelect={(sceneId) => void workspace.selectScene(sceneId)}
            onToggle={() => setScenePanelCollapsed((current) => !current)}
          />
        </div>}
        {workspace.mode === 'characters' && <CharactersView
          characters={workspace.characters}
          scenes={workspace.scenes}
        />}
      </section>
    </div>
  </div>;
}
