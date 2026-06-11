import React from 'react';
import {ArrowLeftOutlined, QuestionCircleOutlined, UserOutlined} from '@ant-design/icons';

interface Props {
  characterName: string;
  onBack: () => void;
  onStepClick: (key: StepKey) => void;
}

type StepKey = 'parameters' | 'variants' | 'editor' | 'references' | 'model3d';

const STEPS: Array<{key: StepKey; label: string; state: 'done' | 'active' | 'pending'}> = [
  {key: 'parameters', label: 'Параметры', state: 'done'},
  {key: 'variants', label: 'Варианты', state: 'done'},
  {key: 'editor', label: 'Редактор', state: 'done'},
  {key: 'references', label: 'Референсы', state: 'done'},
  {key: 'model3d', label: '3D модель', state: 'active'},
];

const StepperHeader: React.FC<Props> = ({characterName, onBack, onStepClick}) => {
  return (
    <header className="c3d-header">
      <div className="c3d-header__left">
        <button type="button" className="c3d-header__back" onClick={onBack} aria-label="Назад">
          <ArrowLeftOutlined />
        </button>
        <div className="c3d-header__brand">
          <span className="c3d-header__mark" aria-hidden="true">
            <svg viewBox="0 0 28 28">
              <defs>
                <linearGradient id="brand-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#F5B400" />
                  <stop offset="100%" stopColor="#FFD15A" />
                </linearGradient>
              </defs>
              <path d="M5 22 L13 5 L15 5 L23 22 L19 22 L17 18 L11 18 L9 22 Z" fill="url(#brand-grad)" />
              <circle cx={14} cy={14} r={2.2} fill="#fff" opacity={0.92} />
            </svg>
          </span>
          <div className="c3d-header__title">
            <strong>WCraft</strong>
            <span>{characterName} · 3D модель</span>
          </div>
        </div>
      </div>

      <ol className="c3d-stepper" aria-label="Шаги создания персонажа">
        {STEPS.map((step, index) => (
          <li key={step.key} className={`c3d-stepper__item c3d-stepper__item--${step.state}`}>
            <button
              type="button"
              className="c3d-stepper__button"
              onClick={() => onStepClick(step.key)}
              disabled={step.state === 'active'}
            >
              <span className="c3d-stepper__index">{index + 1}</span>
              <span className="c3d-stepper__label">{step.label}</span>
            </button>
            {index < STEPS.length - 1 ? <span className="c3d-stepper__line" /> : null}
          </li>
        ))}
      </ol>

    </header>
  );
};

export default StepperHeader;
