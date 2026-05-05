import React from 'react';
import {ColorPicker} from 'antd';
import {CharacterRegion} from '../types/character.types';
import BodyControls from './BodyControls';
import HairControls from './HairControls';
import OutfitControls from './OutfitControls';
import StyleControls from './StyleControls';
import TextRefinementBox from './TextRefinementBox';

const SKIN_PRESETS = [
  {key: 'fair',   color: '#f0c7a8'},
  {key: 'light',  color: '#d9a77f'},
  {key: 'medium', color: '#a86f45'},
  {key: 'olive',  color: '#8f6c43'},
  {key: 'tan',    color: '#74492e'},
  {key: 'dark',   color: '#4a2d22'},
];

export default function CharacterSettingsPanel({region, controls, onControlsChange, textRefinement, onTextRefinementChange}: {region: CharacterRegion; controls: Record<string, unknown>; onControlsChange: (value: Record<string, unknown>) => void; textRefinement: string; onTextRefinementChange: (value: string) => void}) {
  const control = region === 'face'
    ? <FaceEditorControls value={controls} onChange={onControlsChange} />
    : region === 'hair'
      ? <HairControls value={controls} onChange={onControlsChange} />
      : region === 'body'
        ? <BodyControls value={controls} onChange={onControlsChange} />
        : region === 'outfit'
          ? <OutfitControls value={controls} onChange={onControlsChange} />
          : <StyleControls value={controls} onChange={onControlsChange} />;

  return (
    <div className="character-settings-panel">
      <div className="character-settings-panel__header">
        <p>Контекстная панель</p>
        <h2>Настройки: {regionLabel(region)}</h2>
      </div>
      <div className="character-settings-panel__body">
        {control}
        <div className="character-settings-section character-settings-section--text">
          <TextRefinementBox region={region} value={textRefinement} onChange={onTextRefinementChange} />
        </div>
      </div>
    </div>
  );
}

function regionLabel(region: CharacterRegion) {
  const labels: Record<CharacterRegion, string> = {
    face: 'Лицо',
    hair: 'Волосы',
    body: 'Тело',
    outfit: 'Одежда',
    style: 'Общие параметры',
    full_character: 'Характер',
  };
  return labels[region];
}

function FaceEditorControls({value, onChange}: {value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void}) {
  const update = (key: string, nextValue: unknown) => onChange({...value, [key]: nextValue});
  const age = typeof value.age === 'number' ? value.age : undefined;
  const rawGender = value.gender as string | undefined;
  const showGenderField = rawGender === 'male' || rawGender === 'female';
  const gender = rawGender || 'male';
  const skinTone = (value.skin_tone as string) || '';
  const skinToneIsPreset = SKIN_PRESETS.some((p) => p.key === skinTone);
  const skinToneColor = SKIN_PRESETS.find((p) => p.key === skinTone)?.color ?? skinTone ?? '#a86f45';

  return (
    <div className="face-editor-controls">
      <section className="character-settings-section character-settings-section--primary">
        <h3>Основное</h3>
        <div className="character-control-row">
          <div>
            <span className="character-control-label">Возраст</span>
            <small>Базовый возраст персонажа</small>
          </div>
          <strong>{typeof age === 'number' ? `${age} лет` : 'Не задан'}</strong>
        </div>
        <input
          type="range"
          min={0}
          max={130}
          value={age ?? 22}
          onChange={(e) => update('age', Number(e.target.value))}
          style={{width: '100%'}}
        />

        {showGenderField && (
          <div className="character-control-block">
            <span className="character-control-label">Пол</span>
            <div className="character-segmented">
              {[
                ['male', 'Мужской'],
                ['female', 'Женский'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={gender === key ? 'is-active' : ''}
                  onClick={() => update('gender', key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="character-control-block">
          <span className="character-control-label">Цвет кожи</span>
          <div className="skin-tone-palette">
            {SKIN_PRESETS.map(({key, color}) => (
              <button
                key={key}
                type="button"
                className={skinTone === key ? 'is-active' : ''}
                style={{backgroundColor: color}}
                onClick={() => update('skin_tone', key)}
                aria-label={`Цвет кожи ${key}`}
              />
            ))}
            <ColorPicker
              value={skinToneColor}
              onChange={(_, hex) => update('skin_tone', hex)}
              size="small"
              className={skinTone && !skinToneIsPreset ? 'is-active' : ''}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
