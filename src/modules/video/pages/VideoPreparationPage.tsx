import {
  ArrowLeftOutlined,
  CheckOutlined,
  ExclamationCircleOutlined,
  RightOutlined,
} from '@ant-design/icons';
import React from 'react';
import {useTranslation} from 'react-i18next';
import {Link, useParams} from 'react-router-dom';

import DashboardHeader from '../../profile/components/DashboardHeader';
import {
  characterCreatePath,
  projectDashboardPath,
  scriptScenePath,
  videoGenerationPath,
} from '../../../routes/pathConstant';
import type {VideoPreparationResponse} from '../api';
import {useVideoPreparation} from '../useVideoPreparation';
import '../video.css';
import VideoPreparationState from './VideoPreparationState';

interface CompletionMarkProps {
  complete: boolean;
}

function CompletionMark({complete}: CompletionMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`video-preparation-checkbox${complete ? ' is-complete' : ''}`}
    >
      {complete && <CheckOutlined />}
    </span>
  );
}

interface PreparationChecklistProps {
  data: VideoPreparationResponse;
}

export function PreparationChecklist({data}: PreparationChecklistProps) {
  const {t} = useTranslation();
  const {project, missingCharacters, emptyScenes, storyboard} = data;
  const progressPercent = Math.round(Math.max(0, Math.min(1, storyboard.progress)) * 100);
  const canEdit = project.permissions.canEdit;

  return (
    <>
      <section
        aria-label={t('videoPreparation.summary.label', {
          defaultValue: 'Статус подготовки к видео',
        })}
        className={`video-preparation-summary${data.ready ? ' is-ready' : ''}`}
      >
        <div>
          <strong>
            {data.ready
              ? t('videoPreparation.summary.ready', {
                defaultValue: 'Готово к созданию видео',
              })
              : t('videoPreparation.summary.notReady', {
                defaultValue: 'Проект пока не готов к видео',
              })}
          </strong>
          <span>
            {data.ready
              ? t('videoPreparation.summary.readyHint', {
                defaultValue: 'Все обязательные задачи выполнены.',
              })
              : t('videoPreparation.summary.taskCount', {
                count: data.taskCount,
                defaultValue: `Осталось задач: ${data.taskCount}`,
              })}
          </span>
        </div>
        {data.ready
          ? <CheckOutlined aria-hidden="true" className="video-preparation-summary__icon" />
          : <ExclamationCircleOutlined aria-hidden="true" className="video-preparation-summary__icon" />}
      </section>

      <div className="video-preparation-list">
        <section className="video-preparation-group" aria-labelledby="missing-character-group">
          <header>
            <CompletionMark complete={missingCharacters.length === 0} />
            <h2 id="missing-character-group">
              {t('videoPreparation.missingCharacters.title', {
                defaultValue: 'Недостающие персонажи',
              })}
            </h2>
            <span className="video-preparation-group__meta">
              {missingCharacters.length}
            </span>
          </header>
          {missingCharacters.length > 0 && (
            <ul className="video-preparation-items">
              {missingCharacters.map((character) => (
                <li key={character.name}>
                  <div className="video-preparation-item-copy">
                    <strong>{character.name}</strong>
                    <small>
                      {t('videoPreparation.missingCharacters.stats', {
                        defaultValue: `${character.dialogueCount} реплик · ${character.sceneCount} сцен`,
                        dialogueCount: character.dialogueCount,
                        sceneCount: character.sceneCount,
                      })}
                    </small>
                  </div>
                  {canEdit && (
                    <Link
                      aria-label={t('videoPreparation.missingCharacters.createLabel', {
                        defaultValue: `Создать персонажа «${character.name}»`,
                        name: character.name,
                      })}
                      className="video-preparation-link"
                      state={{initialCharacterName: character.name}}
                      to={characterCreatePath(project.id)}
                    >
                      {t('videoPreparation.missingCharacters.create', {
                        defaultValue: 'Создать персонажа',
                      })}
                      <RightOutlined aria-hidden="true" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="video-preparation-group" aria-labelledby="empty-scenes-group">
          <header>
            <CompletionMark complete={emptyScenes.length === 0} />
            <h2 id="empty-scenes-group">
              {t('videoPreparation.emptyScenes.title', {defaultValue: 'Пустые сцены'})}
            </h2>
            <span className="video-preparation-group__meta">{emptyScenes.length}</span>
          </header>
          {emptyScenes.length > 0 && (
            <ul className="video-preparation-items">
              {emptyScenes.map((scene) => (
                <li key={scene.sceneId}>
                  <div className="video-preparation-item-copy">
                    <strong>{scene.title}</strong>
                    <small>
                      {t('videoPreparation.emptyScenes.position', {
                        defaultValue: `Сцена ${scene.order}`,
                        order: scene.order,
                      })}
                    </small>
                  </div>
                  <Link
                    aria-label={t('videoPreparation.emptyScenes.openLabel', {
                      defaultValue: `Открыть сцену «${scene.title}»`,
                      title: scene.title,
                    })}
                    className="video-preparation-link"
                    to={scriptScenePath(project.id, scene.sceneId)}
                  >
                    {t('videoPreparation.emptyScenes.open', {defaultValue: 'Открыть сцену'})}
                    <RightOutlined aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {!storyboard.ready && (
          <section className="video-preparation-group" aria-labelledby="storyboard-group">
            <header>
              <CompletionMark complete={false} />
              <h2 id="storyboard-group">
                {t('videoPreparation.storyboard.title', {
                  defaultValue: 'Полное покрытие сценария раскадровкой',
                })}
              </h2>
              <span className="video-preparation-group__meta">{progressPercent}%</span>
            </header>
            <>
              <p className="video-preparation-storyboard-detail">
                {t('videoPreparation.storyboard.detail', {
                  defaultValue: `${storyboard.readyCount} из ${storyboard.totalCount} сцен готовы · без раскадровки: ${storyboard.missingCount} · устарели: ${storyboard.staleCount}`,
                  missingCount: storyboard.missingCount,
                  readyCount: storyboard.readyCount,
                  staleCount: storyboard.staleCount,
                  totalCount: storyboard.totalCount,
                })}
              </p>
              <div
                aria-label={t('videoPreparation.storyboard.progressLabel', {
                  defaultValue: `Готовность раскадровки: ${progressPercent}%`,
                  progress: progressPercent,
                })}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={progressPercent}
                className="video-preparation-progress"
                role="progressbar"
              >
                <span style={{width: `${progressPercent}%`}} />
              </div>
            </>
          </section>
        )}
      </div>
    </>
  );
}

export default function VideoPreparationPage() {
  const {t} = useTranslation();
  const {projectId = ''} = useParams<{projectId: string}>();
  const {data, error, loading, retry} = useVideoPreparation(projectId);

  if (loading || error || !data) {
    return (
      <div className="video-preparation-page">
        <DashboardHeader hideSubnav />
        <VideoPreparationState error={loading ? null : error ?? 'unknown'} onRetry={retry} />
      </div>
    );
  }

  return (
    <div className="video-preparation-page">
      <DashboardHeader hideSubnav />
      <main className="video-preparation-main">
        <header className="video-preparation-header">
          <div>
            <h1>{t('videoPreparation.title', {defaultValue: 'Подготовка к созданию видео'})}</h1>
            <p>
              {t('videoPreparation.subtitle', {
                defaultValue: `Завершите обязательные задачи проекта «${data.project.title}».`,
                projectTitle: data.project.title,
              })}
            </p>
          </div>
          <Link className="video-preparation-back" to={projectDashboardPath(projectId)}>
            <ArrowLeftOutlined aria-hidden="true" />
            {t('videoPreparation.backToProject', {defaultValue: 'К проекту'})}
          </Link>
        </header>

        <PreparationChecklist data={data} />

        {data.ready && data.project.permissions.canRunGeneration && (
          <div className="video-preparation-actions">
            <Link className="video-preparation-action" to={videoGenerationPath(projectId)}>
              {t('videoPreparation.createVideo', {defaultValue: 'Создать видео'})}
              <RightOutlined aria-hidden="true" />
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
