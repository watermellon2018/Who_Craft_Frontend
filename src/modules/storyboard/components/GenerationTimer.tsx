import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {formatElapsedTime} from '../generationTiming';

export interface GenerationTiming {
  startedAt: number;
  estimatedSeconds: number;
}

export default function GenerationTimer({startedAt, estimatedSeconds}: GenerationTiming) {
  const {t} = useTranslation();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  const elapsed = Math.max(0, (now - startedAt) / 1000);
  const remaining = Math.max(0, estimatedSeconds - elapsed);
  return (
    <div className="storyboard-generation-timer">
      <span aria-live="off">{t('storyboard.ai.timing.elapsed', {time: formatElapsedTime(elapsed)})}</span>
      <span aria-live="off">{remaining > 0
        ? t('storyboard.ai.timing.remaining', {time: formatElapsedTime(Math.ceil(remaining))})
        : t('storyboard.ai.timing.longer')}</span>
      <small>{t('storyboard.ai.timing.hint')}</small>
    </div>
  );
}
