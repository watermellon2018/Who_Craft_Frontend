import {Checkbox} from 'antd';
import React, {useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';

import type {CompositionSubject} from '../model';

interface CompositionEditorProps {
  subjects: CompositionSubject[];
  onChange: (subjects: CompositionSubject[]) => void;
}

interface DragState {
  mode: 'move' | 'resize';
  pointerId: number;
  startHeight: number;
  startWidth: number;
  startX: number;
  startY: number;
  subjectId: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function CompositionEditor({subjects, onChange}: CompositionEditorProps) {
  const {t} = useTranslation();
  const frameRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [guides, setGuides] = useState(['thirds']);
  const subjectLabels = useMemo(
    () => new Map(subjects.map(({subjectId}) => [subjectId, subjectId.split('-').pop() || subjectId])),
    [subjects],
  );

  const updateSubject = (subjectId: string, patch: Partial<CompositionSubject>) => {
    onChange(subjects.map((subject) => (
      subject.subjectId === subjectId ? {...subject, ...patch} : subject
    )));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || !frameRef.current || event.pointerId !== dragState.pointerId) return;
    const bounds = frameRef.current.getBoundingClientRect();
    const deltaX = ((event.clientX - dragState.startX) / bounds.width) * 100;
    const deltaY = ((event.clientY - dragState.startY) / bounds.height) * 100;
    const subject = subjects.find(({subjectId}) => subjectId === dragState.subjectId);
    if (!subject) return;

    if (dragState.mode === 'resize') {
      updateSubject(subject.subjectId, {
        height: clamp(dragState.startHeight + deltaY, 12, 100 - subject.y),
        width: clamp(dragState.startWidth + deltaX, 12, 100 - subject.x),
      });
      return;
    }

    updateSubject(subject.subjectId, {
      x: clamp(subject.x + deltaX, 0, 100 - subject.width),
      y: clamp(subject.y + deltaY, 0, 100 - subject.height),
    });
    setDragState({...dragState, startX: event.clientX, startY: event.clientY});
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    subject: CompositionSubject,
  ) => {
    const step = event.shiftKey ? 5 : 1;
    const patch: Partial<CompositionSubject> = {};
    if (event.altKey) {
      if (event.key === 'ArrowLeft') patch.width = clamp(subject.width - step, 12, 100 - subject.x);
      if (event.key === 'ArrowRight') patch.width = clamp(subject.width + step, 12, 100 - subject.x);
      if (event.key === 'ArrowUp') patch.height = clamp(subject.height - step, 12, 100 - subject.y);
      if (event.key === 'ArrowDown') patch.height = clamp(subject.height + step, 12, 100 - subject.y);
    } else {
      if (event.key === 'ArrowLeft') patch.x = clamp(subject.x - step, 0, 100 - subject.width);
      if (event.key === 'ArrowRight') patch.x = clamp(subject.x + step, 0, 100 - subject.width);
      if (event.key === 'ArrowUp') patch.y = clamp(subject.y - step, 0, 100 - subject.height);
      if (event.key === 'ArrowDown') patch.y = clamp(subject.y + step, 0, 100 - subject.height);
    }
    if (Object.keys(patch).length === 0) return;
    event.preventDefault();
    updateSubject(subject.subjectId, patch);
  };

  return (
    <div>
      <div
        className={`storyboard-composition${guides.includes('thirds') ? ' storyboard-composition--thirds' : ''}${guides.includes('center') ? ' storyboard-composition--center' : ''}${guides.includes('safe') ? ' storyboard-composition--safe' : ''}`}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDragState(null)}
        ref={frameRef}
      >
        {subjects.map((subject) => (
          <div
            aria-describedby="storyboard-composition-keyboard-help"
            aria-label={t('storyboard.composition.subject', {name: subjectLabels.get(subject.subjectId)})}
            aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.round(subject.x)}
            aria-valuetext={t('storyboard.composition.subjectPosition', {
              height: Math.round(subject.height),
              width: Math.round(subject.width),
              x: Math.round(subject.x),
              y: Math.round(subject.y),
            })}
            className="storyboard-composition__subject"
            key={subject.subjectId}
            onKeyDown={(event) => handleKeyDown(event, subject)}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setDragState({
                mode: 'move',
                pointerId: event.pointerId,
                startHeight: subject.height,
                startWidth: subject.width,
                startX: event.clientX,
                startY: event.clientY,
                subjectId: subject.subjectId,
              });
            }}
            role="slider"
            style={{
              height: `${subject.height}%`,
              left: `${subject.x}%`,
              top: `${subject.y}%`,
              width: `${subject.width}%`,
            }}
            tabIndex={0}
          >
            {subjectLabels.get(subject.subjectId)}
            <span
              aria-hidden="true"
              className="storyboard-composition__resize"
              onPointerDown={(event) => {
                event.stopPropagation();
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragState({
                  mode: 'resize',
                  pointerId: event.pointerId,
                  startHeight: subject.height,
                  startWidth: subject.width,
                  startX: event.clientX,
                  startY: event.clientY,
                  subjectId: subject.subjectId,
                });
              }}
            />
          </div>
        ))}
      </div>
      <p className="storyboard-muted" id="storyboard-composition-keyboard-help">
        {t('storyboard.composition.keyboardHelp')}
      </p>
      <Checkbox.Group
        className="storyboard-composition__guides"
        onChange={(values) => setGuides(values.map(String))}
        options={[
          {label: t('storyboard.composition.ruleOfThirds'), value: 'thirds'},
          {label: t('storyboard.composition.center'), value: 'center'},
          {label: t('storyboard.composition.safeArea'), value: 'safe'},
        ]}
        value={guides}
      />
    </div>
  );
}
