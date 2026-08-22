import React from 'react';
import {useTranslation} from 'react-i18next';

interface VideoPreparationStateProps {
  error?: 'forbidden' | 'notFound' | 'unknown' | null;
  onRetry?: () => void;
}

export default function VideoPreparationState({
  error = null,
  onRetry,
}: VideoPreparationStateProps) {
  const {t} = useTranslation();

  if (!error) {
    return (
      <main aria-busy="true" className="video-preparation-state">
        <span aria-hidden="true" />
        <p role="status">
          {t('videoPreparation.loading', {defaultValue: 'Проверяем готовность проекта…'})}
        </p>
      </main>
    );
  }

  const message = error === 'forbidden'
    ? t('videoPreparation.errors.forbidden', {
      defaultValue: 'У вас нет доступа к подготовке этого проекта.',
    })
    : error === 'notFound'
      ? t('videoPreparation.errors.notFound', {defaultValue: 'Проект не найден.'})
      : t('videoPreparation.errors.unknown', {
        defaultValue: 'Не удалось проверить готовность проекта.',
      });

  return (
    <main className="video-preparation-state">
      <p role="alert">{message}</p>
      {error === 'unknown' && onRetry && (
        <button className="video-preparation-retry" onClick={onRetry} type="button">
          {t('videoPreparation.retry', {defaultValue: 'Повторить'})}
        </button>
      )}
    </main>
  );
}
