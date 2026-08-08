import {
  AppstoreOutlined,
  CheckOutlined,
  DownloadOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import React from 'react';
import {useNavigate} from 'react-router-dom';
import WCraftBrand from '../../components/WCraftBrand';

import {useProjectIdFromRoute} from '../../modules/character-studio/hooks/useProjectIdFromRoute';
import {useUnsavedChangesGuard} from '../../utils/useUnsavedChangesGuard';
import PathConstants, {musicStudioCreatePath, projectDashboardPath} from '../../routes/pathConstant';
import {sceneToPlainText} from './api';
import {canBypassUnsavedChangesAfterSelectedSceneSave} from './navigation';
import CardsView from './CardsView';
import CharactersView from './CharactersView';
import LocationsPlaceholder from './LocationsPlaceholder';
import ScreenplayView from './ScreenplayView';
import './style.css';
import type {WorkspaceMode} from './types';
import {useScriptWorkspace} from './useScriptWorkspace';

const MODE_ITEMS: Array<{mode: WorkspaceMode; label: string; icon: React.ReactNode}> = [
  {mode: 'screenplay', label: 'Сценарий', icon: <FileTextOutlined />},
  {mode: 'cards', label: 'Карточки', icon: <AppstoreOutlined />},
  {mode: 'characters', label: 'Персонажи', icon: <TeamOutlined />},
  {mode: 'locations', label: 'Локации', icon: <EnvironmentOutlined />},
];

const formatDuration = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} ч ${rest ? `${rest} мин` : ''}`.trim();
};

export default function ScriptPage() {
  const projectId = useProjectIdFromRoute();
  const navigate = useNavigate();
  const workspace = useScriptWorkspace(projectId);
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
    if (!saved) return;
    if (!projectId) return;
    if (canBypassUnsavedChangesAfterSelectedSceneSave(
      workspace.dirtySceneIds,
      workspace.selectedScene?.id,
    )) {
      allowNextNavigation();
    }
    navigate(projectDashboardPath(projectId));
  };

  const createMusicForScene = (sceneId: number) => {
    if (!projectId) return;
    navigate(musicStudioCreatePath(projectId, sceneId));
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

  return <div className="script-workspace">
    <header className="script-topbar">
      <WCraftBrand className="script-topbar__brand" />
      <div className="script-project-heading">
        <div><button onClick={() => navigate(PathConstants.PROJECTS)}>Все проекты</button><span>/</span><span>Сценарий</span></div>
        <h1>{workspace.project.title}</h1>
        <small className={workspace.canEdit ? 'is-saved' : ''}>
          {workspace.canEdit
            ? selectedSaving ? 'Сохраняем…' : selectedDirty ? 'Есть изменения' : 'Сохранено'
            : 'Только просмотр'}
        </small>
      </div>
      <div className="script-topbar__actions">
        {workspace.canEdit && <button
          className="script-button"
          disabled={!selectedDirty || selectedSaving}
          onClick={() => void workspace.saveSelectedScene()}
        ><SaveOutlined /> Сохранить</button>}
        <button className="script-button" disabled={workspace.scenes.length === 0} onClick={exportScript}>
          <DownloadOutlined /> Экспорт
        </button>
        <button className="script-button script-button--primary" onClick={() => void finish()}>
          <CheckOutlined /> Готово
        </button>
      </div>
    </header>

    <aside className="script-rail">
      <div className="script-rail__modes">
        {MODE_ITEMS.map((item) => (
          <button
            key={item.mode}
            aria-label={item.label}
            className={workspace.mode === item.mode ? 'is-active' : ''}
            title={item.label}
            onClick={() => void workspace.changeMode(item.mode)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <div className="script-rail__support">
        <button disabled aria-label="Настройки недоступны" title="Настройки сценария пока недоступны"><SettingOutlined /></button>
        <button disabled aria-label="Помощь недоступна" title="Раздел помощи пока недоступен"><QuestionCircleOutlined /></button>
      </div>
    </aside>

    <section className="script-stats">
      <div><strong>{workspace.stats.sceneCount}</strong><span>сцен</span></div>
      <div><strong>{formatDuration(workspace.stats.totalDurationSeconds)}</strong><span>хронометраж</span></div>
      {workspace.stats.acts.map((act) => {
        const percent = workspace.stats.totalDurationSeconds
          ? Math.round(act.durationSeconds / workspace.stats.totalDurationSeconds * 100)
          : 0;
        return <div key={act.act} className={`script-act-stat script-act-stat--${act.act}`}>
          <span>АКТ {act.act}</span>
          <i><b style={{width: `${percent}%`}} /></i>
          <small>{percent}% · {formatDuration(act.durationSeconds)}</small>
        </div>;
      })}
      {workspace.canEdit && <button className="script-add-scene" onClick={() => void workspace.addScene()}>
        <PlusOutlined /> Добавить сцену
      </button>}
    </section>

    {(workspace.conflict || workspace.saveError) && <div className="script-alert" role="alert">
      <span>{workspace.conflict?.message || workspace.saveError}</span>
      {workspace.conflict
        ? <button onClick={() => void workspace.reload()}><ReloadOutlined /> Перезагрузить</button>
        : <button onClick={workspace.dismissSaveError}>Закрыть</button>}
    </div>}

    <section className="script-workspace__content">
      {workspace.mode === 'cards' && <CardsView
        scenes={workspace.scenes}
        characters={workspace.characters}
        selectedScene={workspace.selectedScene}
        characterFilter={workspace.characterSceneFilter}
        canEdit={workspace.canEdit}
        canRunGeneration={workspace.canRunGeneration}
        dirtySceneIds={workspace.dirtySceneIds}
        savingSceneIds={workspace.savingSceneIds}
        onAdd={() => void workspace.addScene()}
        onChange={workspace.updateScene}
        onClearFilter={() => workspace.setCharacterSceneFilter(null)}
        onDelete={deleteScene}
        onCreateMusic={createMusicForScene}
        onOpenScreenplay={() => void workspace.changeMode('screenplay')}
        onSave={() => void workspace.saveSelectedScene()}
        onSelect={(sceneId) => void workspace.selectScene(sceneId)}
      />}
      {workspace.mode === 'screenplay' && <ScreenplayView
        scenes={workspace.scenes}
        characters={workspace.characters}
        selectedScene={workspace.selectedScene}
        canEdit={workspace.canEdit}
        canRunGeneration={workspace.canRunGeneration}
        dirtySceneIds={workspace.dirtySceneIds}
        savingSceneIds={workspace.savingSceneIds}
        onAddScene={() => void workspace.addScene()}
        onChange={workspace.updateScene}
        onDeleteScene={deleteScene}
        onCreateMusic={createMusicForScene}
        onSave={() => void workspace.saveSelectedScene()}
        onSelect={(sceneId) => void workspace.selectScene(sceneId)}
      />}
      {workspace.mode === 'characters' && <CharactersView characters={workspace.characters} />}
      {workspace.mode === 'locations' && <LocationsPlaceholder />}
    </section>
  </div>;
}
