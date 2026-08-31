import {ReadOutlined} from '@ant-design/icons';
import {Alert, Button, Drawer} from 'antd';
import React, {useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';

import type {StoryboardScene, StoryboardShot} from '../model';
import {sourceRangesForShot, splitSourceText} from '../sourceSelection';
import {sourceLayout} from '../sourceLayout';

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
  const blocks = sourceLayout(text, scene.scriptBlocks).map((block) => {
    const length = Array.from(block.text).length;
    return {...block, parts: splitSourceText(block.text, ranges.map((range) => ({
      start: Math.max(0, range.start - block.start),
      end: Math.min(length, range.end - block.start),
    })))};
  });
  const formatted = blocks.some((block) => block.type);
  const firstStart = blocks.flatMap((block) => block.parts
    .filter((part) => part.highlighted && part.text.trim())
    .map((part) => block.start + part.start))[0];
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
        {!missing && <p>{t(shot.source?.origin === 'manual'
          ? 'storyboard.source.manualHighlightHelp' : 'storyboard.source.highlightHelp')}</p>}
        <div className={`storyboard-source-viewer__text${formatted ? ' storyboard-source-viewer__text--formatted' : ''}`}>
          {blocks.map((block) => {
            const content = block.parts.map((part) => part.highlighted ? (
              <mark
                key={part.start}
                ref={block.start + part.start === firstStart ? firstHighlightRef : undefined}
              >
                {part.text}
              </mark>
            ) : <React.Fragment key={part.start}>{part.text}</React.Fragment>);
            return block.type ? (
              <p key={block.start} className={`storyboard-script__block storyboard-script__block--${block.type} storyboard-source-viewer__block`}>
                {content}
              </p>
            ) : <React.Fragment key={block.start}>{content}</React.Fragment>;
          })}
        </div>
      </Drawer>
    </div>
  );
}
