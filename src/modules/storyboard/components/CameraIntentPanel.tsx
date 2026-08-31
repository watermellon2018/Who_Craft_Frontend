import {CopyOutlined, ReloadOutlined} from '@ant-design/icons';
import {Button, InputNumber, Segmented, Select, Slider, Tabs} from 'antd';
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';

import {detectCameraMovement, sortKeyframes} from '../model';
import type {
  CameraAzimuth,
  CameraDistance,
  CameraElevation,
  CameraFraming,
  CameraIntent,
  CameraMovementType,
  CompositionSubject,
  StoryboardKeyframe,
  StoryboardShot,
} from '../model';
import CameraPlacementDiagram from './CameraPlacementDiagram';
import CompositionEditor from './CompositionEditor';

interface CameraIntentPanelProps {
  keyframe: StoryboardKeyframe | null;
  shot: StoryboardShot | null;
  onDuplicateSettings: () => void;
  onReset: () => void;
  onUpdateIntent: (intent: CameraIntent) => void;
  onUpdateTransition: (transitionId: string, movementOverride?: CameraMovementType) => void;
}

const HEIGHTS: CameraElevation[] = ['low', 'eye-level', 'high', 'top'];
const DISTANCES: CameraDistance[] = ['wide', 'medium', 'near'];
const FRAMINGS: CameraFraming[] = [
  'extreme-wide',
  'wide',
  'full',
  'medium',
  'medium-close',
  'close',
  'extreme-close',
  'ots',
  'pov',
];
const LENSES = [24, 35, 50, 85];
const MOVEMENTS: CameraMovementType[] = [
  'Static',
  'Dolly In',
  'Dolly Out',
  'Pan Left',
  'Pan Right',
  'Tilt Up',
  'Tilt Down',
  'Orbit Left',
  'Orbit Right',
  'Truck Left',
  'Truck Right',
  'Crane Up',
  'Crane Down',
  'Follow',
  'Custom',
];

function readableEntity(id: string) {
  const value = id.split('-').pop() || id;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function CameraIntentPanel({
  keyframe,
  shot,
  onDuplicateSettings,
  onReset,
  onUpdateIntent,
  onUpdateTransition,
}: CameraIntentPanelProps) {
  const {t} = useTranslation();
  const intent = keyframe?.cameraIntent;
  const targetOptions = useMemo(() => {
    if (!shot) return [];
    return [
      ...shot.characterIds.map((id) => ({label: readableEntity(id), value: id})),
      ...shot.referenceIds.map((id) => ({label: readableEntity(id), value: id})),
      {label: t('storyboard.camera.groupCenter'), value: 'group-center'},
    ];
  }, [shot, t]);

  if (!keyframe || !shot || !intent) return null;

  const keyframes = sortKeyframes(shot.keyframes);
  const currentIndex = keyframes.findIndex(({id}) => id === keyframe.id);
  const fromIndex = currentIndex < keyframes.length - 1 ? currentIndex : currentIndex - 1;
  const fromKeyframe = fromIndex >= 0 ? keyframes[fromIndex] : null;
  const toKeyframe = fromIndex >= 0 ? keyframes[fromIndex + 1] : null;
  const transition = fromKeyframe && toKeyframe
    ? shot.transitions.find(({fromKeyframeId, toKeyframeId}) => (
      fromKeyframeId === fromKeyframe.id && toKeyframeId === toKeyframe.id
    ))
    : undefined;
  const detectedMovement = fromKeyframe && toKeyframe
    ? detectCameraMovement(fromKeyframe.cameraIntent, toKeyframe.cameraIntent)
    : 'Static';
  const movement = transition?.movementOverride ?? detectedMovement;
  const composition: CompositionSubject[] = intent.composition?.length
    ? intent.composition
    : [{height: 48, subjectId: intent.targetId || 'group-center', width: 28, x: 58, y: 27}];

  const cameraTab = (
    <div className="storyboard-camera-grid">
      <div className="storyboard-control-group">
        <label className="storyboard-control-group__title" htmlFor="storyboard-camera-target">
          {t('storyboard.camera.relativeTo')}
        </label>
        <Select
          id="storyboard-camera-target"
          onChange={(targetId) => onUpdateIntent({...intent, targetId})}
          options={targetOptions}
          style={{width: '100%'}}
          value={intent.targetId || 'group-center'}
        />
        <span className="storyboard-control-group__title" style={{marginTop: 16}}>
          {t('storyboard.camera.position')}
        </span>
        <CameraPlacementDiagram
          onChange={(azimuth: CameraAzimuth) => onUpdateIntent({...intent, azimuth})}
          targetLabel={readableEntity(intent.targetId || 'group-center')}
          value={intent.azimuth}
        />
      </div>

      <div className="storyboard-stack">
        <div className="storyboard-control-group">
          <span className="storyboard-control-group__title">{t('storyboard.camera.height')}</span>
          <Segmented
            block
            onChange={(elevation) => onUpdateIntent({...intent, elevation: elevation as CameraElevation})}
            options={HEIGHTS.map((value) => ({label: t(`storyboard.camera.elevation.${value}`), value}))}
            value={intent.elevation}
          />
        </div>
        <div className="storyboard-control-group">
          <span className="storyboard-control-group__title">{t('storyboard.camera.distance')}</span>
          <Segmented
            block
            onChange={(distance) => onUpdateIntent({...intent, distance: distance as CameraDistance})}
            options={DISTANCES.map((value) => ({label: t(`storyboard.camera.distanceValue.${value}`), value}))}
            value={intent.distance}
          />
        </div>
        <div className="storyboard-control-group">
          <span className="storyboard-control-group__title">{t('storyboard.camera.framing')}</span>
          <Segmented
            block
            onChange={(framing) => onUpdateIntent({...intent, framing: framing as CameraFraming})}
            options={FRAMINGS.map((value) => ({label: t(`storyboard.camera.framingValue.${value}`), value}))}
            value={intent.framing}
          />
        </div>
        {intent.framing === 'ots' && (
          <div className="storyboard-control-group">
            <span className="storyboard-control-group__title">{t('storyboard.camera.ots.title')}</span>
            <div className="storyboard-camera-grid" style={{gridTemplateColumns: '1fr 1fr'}}>
              <Select
                aria-label={t('storyboard.camera.ots.foreground')}
                onChange={(foregroundSubjectId) => onUpdateIntent({
                  ...intent,
                  ots: {...intent.ots, foregroundSubjectId, shoulder: intent.ots?.shoulder || 'left'},
                })}
                options={shot.characterIds.map((id) => ({label: readableEntity(id), value: id}))}
                placeholder={t('storyboard.camera.ots.foreground')}
                value={intent.ots?.foregroundSubjectId}
              />
              <Segmented
                onChange={(shoulder) => onUpdateIntent({
                  ...intent,
                  ots: {...intent.ots, shoulder: shoulder as 'left' | 'right'},
                })}
                options={[
                  {label: t('storyboard.camera.ots.left'), value: 'left'},
                  {label: t('storyboard.camera.ots.right'), value: 'right'},
                ]}
                value={intent.ots?.shoulder || 'left'}
              />
            </div>
          </div>
        )}
        <div className="storyboard-control-group">
          <span className="storyboard-control-group__title">{t('storyboard.camera.lens')}</span>
          <div className="storyboard-row">
            <Segmented
              onChange={(lens) => onUpdateIntent({...intent, lens: Number(lens)})}
              options={LENSES.map((value) => ({label: `${value}`, value}))}
              value={intent.lens}
            />
            <Slider
              aria-label={t('storyboard.camera.lens')}
              max={135}
              min={16}
              onChange={(lens) => onUpdateIntent({...intent, lens})}
              style={{flex: 1, minWidth: 100}}
              value={intent.lens || 50}
            />
            <InputNumber
              addonAfter="mm"
              max={200}
              min={8}
              onChange={(lens) => onUpdateIntent({...intent, lens: lens ?? 50})}
              value={intent.lens}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const compositionTab = (
    <div className="storyboard-control-group">
      <div className="storyboard-section-heading">
        <div>
          <h3>{t('storyboard.composition.title')}</h3>
          <p>{t('storyboard.composition.help')}</p>
        </div>
      </div>
      <CompositionEditor
        onChange={(nextComposition) => onUpdateIntent({...intent, composition: nextComposition})}
        subjects={composition}
      />
    </div>
  );

  const movementTab = (
    <div className="storyboard-movement-card">
      <div>
        <span className="storyboard-muted">{t('storyboard.movement.detected')}</span>
        <strong>{movement}</strong>
        {fromKeyframe && toKeyframe && (
          <span className="storyboard-muted">
            {t(`storyboard.keyframeType.${fromKeyframe.type}`)} → {t(`storyboard.keyframeType.${toKeyframe.type}`)}
          </span>
        )}
      </div>
      <Select
        aria-label={t('storyboard.movement.override')}
        onChange={(value) => {
          if (!transition) return;
          onUpdateTransition(transition.id, value === 'auto' ? undefined : value as CameraMovementType);
        }}
        options={[
          {label: t('storyboard.movement.auto', {movement: detectedMovement}), value: 'auto'},
          ...MOVEMENTS.map((value) => ({label: value, value})),
        ]}
        style={{minWidth: 220}}
        value={transition?.movementOverride || 'auto'}
      />
    </div>
  );

  return (
    <section className="storyboard-camera-panel">
      <div className="storyboard-camera-header">
        <div>
          <p className="storyboard-kicker">{t(`storyboard.keyframeType.${keyframe.type}`)}</p>
          <h3>
            {t('storyboard.camera.title')} · {Math.round(keyframe.position * 100)}%
          </h3>
        </div>
        <div className="storyboard-inline-actions">
          <Button icon={<CopyOutlined aria-hidden="true" />} onClick={onDuplicateSettings} size="small">
            {t('storyboard.camera.duplicateSettings')}
          </Button>
          <Button icon={<ReloadOutlined aria-hidden="true" />} onClick={onReset} size="small">
            {t('storyboard.camera.reset')}
          </Button>
        </div>
      </div>
      <Tabs
        items={[
          {children: cameraTab, key: 'camera', label: t('storyboard.camera.tab')},
          {children: compositionTab, key: 'composition', label: t('storyboard.composition.tab')},
          {children: movementTab, key: 'movement', label: t('storyboard.movement.tab')},
        ]}
      />
    </section>
  );
}
