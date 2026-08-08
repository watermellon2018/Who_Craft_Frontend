import React, {useMemo} from 'react';
import {ArrowLeftOutlined} from '@ant-design/icons';
import type {StudioCharacter} from '../../types/character.types';
import {computeStepStates, StepKey} from './stepProgress';

interface Props {
  characterName: string;
  character: StudioCharacter | null;
  onBack: () => void;
  onStepClick: (key: StepKey) => void;
}

const StepperHeader: React.FC<Props> = ({characterName, character, onBack, onStepClick}) => {
  // Only stages the character has actually reached are clickable; the rest
  // are locked, so the user can't jump into an empty future stage.
  const steps = useMemo(() => computeStepStates(character, 'model3d'), [character]);

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
        {steps.map((step, index) => {
          // 'active' is the current stage; 'locked' stages aren't reachable
          // yet — only 'done' stages navigate.
          const clickable = step.state === 'done';
          return (
            <li key={step.key} className={`c3d-stepper__item c3d-stepper__item--${step.state}`}>
              <button
                type="button"
                className="c3d-stepper__button"
                onClick={() => clickable && onStepClick(step.key)}
                disabled={!clickable}
                aria-current={step.state === 'active' ? 'step' : undefined}
                title={step.state === 'locked' ? 'Этап ещё не пройден' : undefined}
              >
                <span className="c3d-stepper__index">{index + 1}</span>
                <span className="c3d-stepper__label">{step.label}</span>
              </button>
              {index < steps.length - 1 ? <span className="c3d-stepper__line" /> : null}
            </li>
          );
        })}
      </ol>

    </header>
  );
};

export default StepperHeader;
