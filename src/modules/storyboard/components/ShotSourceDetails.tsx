import {ReadOutlined} from '@ant-design/icons';
import {Alert, Button, Drawer} from 'antd';
import React, {useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';

import type {StoryboardScene, StoryboardShot} from '../model';
import {sourceRangesForShot} from '../sourceSelection';
import ReadOnlyScreenplay from './ReadOnlyScreenplay';

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
  const text = document?.segments.map((segment) => segment.text).join('') ?? scene.text;
  const ranges = document ? sourceRangesForShot(shot, text) : [];
  const stale = Boolean(document && scene.version !== undefined
    && document.sceneVersion !== scene.version);
  const missing = ranges.length === 0;

  return (
    <div className="storyboard-shot-source">
      <Button className="craft-action-button--secondary" icon={<ReadOutlined aria-hidden="true" />} onClick={() => setOpen(true)}>
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

        <ReadOnlyScreenplay
          className="storyboard-source-viewer__text"
          firstHighlightRef={firstHighlightRef}
          ranges={ranges}
          scriptBlocks={scene.scriptBlocks}
          text={text}
        />
      </Drawer>
    </div>
  );
}
