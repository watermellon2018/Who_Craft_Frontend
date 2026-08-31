import {ReadOutlined} from '@ant-design/icons';
import {Alert, Button, Drawer} from 'antd';
import React, {useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';

import type {StoryboardScene, StoryboardShot} from '../model';

interface ShotSourceDetailsProps {
  scene: StoryboardScene;
  shot: StoryboardShot;
}

export default function ShotSourceDetails({scene, shot}: ShotSourceDetailsProps) {
  const {t} = useTranslation();
  const [open, setOpen] = useState(false);
  const firstHighlightRef = useRef<HTMLElement | null>(null);
  const source = shot.source?.document;
  const document = source && String(source.sceneId) === scene.id ? source : undefined;
  const selectedIds = new Set(document ? shot.source?.segmentIds : []);
  const selected = document?.segments.filter(({id}) => selectedIds.has(id)) ?? [];
  const firstId = selected[0]?.id;
  const stale = Boolean(document && scene.version !== undefined
    && document.sceneVersion !== scene.version);
  const missing = selected.length === 0;

  return (
    <div className="storyboard-shot-source">
      <details className="storyboard-shot-source__disclosure">
        <summary>{t('storyboard.source.fragment')}</summary>
        {missing ? (
          <p className="storyboard-shot-source__notice">{t('storyboard.source.missing')}</p>
        ) : (
          <>
            {stale && <p className="storyboard-shot-source__notice">{t('storyboard.source.stale')}</p>}
            <div
              aria-label={t('storyboard.source.fragment')}
              className="storyboard-shot-source__excerpt"
              role="region"
              tabIndex={0}
            >
              {document?.segments.map((segment, index, segments) => selectedIds.has(segment.id) && (
                <React.Fragment key={segment.id}>
                  {index > 0 && !selectedIds.has(segments[index - 1].id) && (
                    <span className="storyboard-shot-source__gap" aria-label={t('storyboard.source.gap')}>…</span>
                  )}
                  {segment.text}
                </React.Fragment>
              ))}
            </div>
          </>
        )}
      </details>
      <Button icon={<ReadOutlined aria-hidden="true" />} onClick={() => setOpen(true)}>
        {t('storyboard.source.showInScript')}
      </Button>
      <Drawer
        afterOpenChange={(visible) => {
          if (visible) firstHighlightRef.current?.scrollIntoView?.({block: 'center'});
        }}
        className="storyboard-source-viewer"
        destroyOnClose
        onClose={() => setOpen(false)}
        open={open}
        title={t('storyboard.source.sceneTitle', {title: scene.title})}
        width="min(760px, 100vw)"
      >
        <h3>{shot.title}</h3>
        {missing && <Alert message={t('storyboard.source.missing')} showIcon type="info" />}
        {stale && <Alert message={t('storyboard.source.stale')} showIcon type="warning" />}
        {document?.truncated && (
          <Alert message={t('storyboard.source.truncated')} showIcon type="warning" />
        )}
        {!missing && <p>{t('storyboard.source.highlightHelp')}</p>}
        <div className="storyboard-source-viewer__text">
          {document ? document.segments.map((segment) => selectedIds.has(segment.id) ? (
            <mark
              key={segment.id}
              ref={segment.id === firstId ? firstHighlightRef : undefined}
            >
              {segment.text}
            </mark>
          ) : <React.Fragment key={segment.id}>{segment.text}</React.Fragment>) : scene.text}
        </div>
      </Drawer>
    </div>
  );
}
