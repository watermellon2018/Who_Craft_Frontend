import {CameraOutlined} from '@ant-design/icons';
import {Tooltip} from 'antd';
import React from 'react';
import {useTranslation} from 'react-i18next';

import type {CameraAzimuth} from '../model';

interface CameraPlacementDiagramProps {
  targetLabel: string;
  value: CameraAzimuth;
  onChange: (value: CameraAzimuth) => void;
}

const POSITIONS: CameraAzimuth[] = [
  'front',
  'front-right',
  'right',
  'back-right',
  'back',
  'back-left',
  'left',
  'front-left',
];

const LINE_ROTATION: Record<CameraAzimuth, number> = {
  back: 90,
  'back-left': 135,
  'back-right': 45,
  front: -90,
  'front-left': -135,
  'front-right': -45,
  left: 180,
  right: 0,
};

export default function CameraPlacementDiagram({
  targetLabel,
  value,
  onChange,
}: CameraPlacementDiagramProps) {
  const {t} = useTranslation();

  return (
    <div className="storyboard-placement">
      <div className="storyboard-placement__target">{targetLabel}</div>
      <span
        aria-hidden="true"
        className="storyboard-placement__line"
        style={{transform: `rotate(${LINE_ROTATION[value]}deg)`}}
      />
      {POSITIONS.map((position) => (
        <Tooltip key={position} title={t(`storyboard.camera.azimuth.${position}`)}>
          <button
            aria-label={t(`storyboard.camera.azimuth.${position}`)}
            aria-pressed={value === position}
            className={`storyboard-placement__position${
              value === position ? ' storyboard-placement__position--active' : ''
            }`}
            data-position={position}
            onClick={() => onChange(position)}
            type="button"
          >
            {value === position ? <CameraOutlined aria-hidden="true" /> : <span aria-hidden="true">●</span>}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
