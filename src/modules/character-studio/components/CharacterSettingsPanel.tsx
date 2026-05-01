import React from 'react';
import {Button, Collapse, Select, Slider} from 'antd';
import {CharacterRegion} from '../types/character.types';
import BodyControls from './BodyControls';
import HairControls from './HairControls';
import OutfitControls from './OutfitControls';
import PreserveOptions from './PreserveOptions';
import StyleControls from './StyleControls';
import TextRefinementBox from './TextRefinementBox';

export default function CharacterSettingsPanel({region, controls, onControlsChange, textRefinement, onTextRefinementChange, preserve, identityLocked, onGenerate}: {region: CharacterRegion; controls: Record<string, unknown>; onControlsChange: (value: Record<string, unknown>) => void; textRefinement: string; onTextRefinementChange: (value: string) => void; preserve: Record<string, boolean>; identityLocked: boolean; onGenerate: () => void}) {
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
        <Collapse
          className="character-settings-collapse character-settings-collapse--secondary"
          ghost
          items={[
            {
              key: 'text',
              label: 'Текстовая доработка',
              children: <TextRefinementBox region={region} value={textRefinement} onChange={onTextRefinementChange} />,
            },
            {
              key: 'preserve',
              label: 'Сохранить при генерации',
              children: <PreserveOptions values={preserve} identityLocked={identityLocked} />,
            },
          ]}
        />
        <Button className="character-editor-button character-editor-button--primary" onClick={onGenerate}>
          Применить к изображению
        </Button>
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
    style: 'Стиль',
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
  const faceShape = (value.face_shape as string) || 'oval';
  const skinTone = (value.skin_tone as string) || 'medium';

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
        <Slider min={0} max={130} value={age ?? 22} onChange={(nextValue) => update('age', nextValue)} />

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
          <span className="character-control-label">Форма лица</span>
          <div className="face-shape-grid">
            {[
              ['oval', 'Овал'],
              ['round', 'Круг'],
              ['square', 'Квадрат'],
              ['heart', 'Сердце'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`face-shape-card${faceShape === key ? ' is-active' : ''}`}
                onClick={() => update('face_shape', key)}
              >
                <span />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="character-control-block">
          <span className="character-control-label">Цвет кожи</span>
          <div className="skin-tone-palette">
            {[
              ['fair', '#f0c7a8'],
              ['light', '#d9a77f'],
              ['medium', '#a86f45'],
              ['olive', '#8f6c43'],
              ['tan', '#74492e'],
              ['dark', '#4a2d22'],
            ].map(([key, color]) => (
              <button
                key={key}
                type="button"
                className={skinTone === key ? 'is-active' : ''}
                style={{backgroundColor: color}}
                onClick={() => update('skin_tone', key)}
                aria-label={`Цвет кожи ${translateOption(key)}`}
              />
            ))}
          </div>
        </div>
      </section>

      <Collapse
        className="character-settings-collapse"
        ghost
        items={[
          {
            key: 'eyes',
            label: 'Глаза',
            children: (
              <div className="character-collapse-content">
                <ControlSelect label="Цвет глаз" value={value.eye_color as string} options={['brown', 'blue', 'green', 'gray', 'hazel', 'amber', 'black']} onChange={(nextValue) => update('eye_color', nextValue)} />
                <ControlSelect label="Форма глаз" value={value.eye_shape as string} options={['almond', 'round', 'narrow', 'hooded', 'upturned', 'downturned']} onChange={(nextValue) => update('eye_shape', nextValue)} />
                <SliderControl label="Размер глаз" value={typeof value.eye_size === 'number' ? value.eye_size : 52} onChange={(nextValue) => update('eye_size', nextValue)} />
                <SliderControl label="Расстояние" value={typeof value.eye_spacing === 'number' ? value.eye_spacing : 46} onChange={(nextValue) => update('eye_spacing', nextValue)} />
              </div>
            ),
          },
          {key: 'eyebrows', label: 'Брови', children: <ControlSelect label="Форма бровей" value={value.eyebrow_shape as string} options={['thin', 'thick', 'straight', 'arched', 'soft', 'sharp']} onChange={(nextValue) => update('eyebrow_shape', nextValue)} />},
          {key: 'nose', label: 'Нос', children: <ControlSelect label="Форма носа" value={value.nose_shape as string} options={['straight', 'button', 'aquiline', 'wide', 'narrow', 'flat', 'sharp']} onChange={(nextValue) => update('nose_shape', nextValue)} />},
          {key: 'lips', label: 'Губы', children: <ControlSelect label="Форма губ" value={value.lips_shape as string} options={['thin', 'medium', 'full', 'sharp', 'soft']} onChange={(nextValue) => update('lips_shape', nextValue)} />},
          {key: 'features', label: 'Особые черты', children: <FeatureChips value={(value.distinctive_features as string[]) || []} onChange={(nextValue) => update('distinctive_features', nextValue)} />},
        ]}
      />
    </div>
  );
}

function ControlSelect({label, value, options, onChange}: {label: string; value?: string; options: string[]; onChange: (value: string) => void}) {
  return (
    <label className="character-control-block">
      <span className="character-control-label">{label}</span>
      <Select
        value={value}
        placeholder="Выберите значение"
        popupClassName="character-editor-select-dropdown"
        options={options.map((option) => ({value: option, label: translateOption(option)}))}
        onChange={onChange}
      />
    </label>
  );
}

function SliderControl({label, value, onChange}: {label: string; value: number; onChange: (value: number) => void}) {
  return (
    <div className="character-control-block">
      <div className="character-control-row">
        <span className="character-control-label">{label}</span>
        <strong>{value}%</strong>
      </div>
      <Slider value={value} onChange={onChange} />
    </div>
  );
}

function FeatureChips({value, onChange}: {value: string[]; onChange: (value: string[]) => void}) {
  const features = ['freckles', 'mole', 'scar', 'birthmark', 'glasses'];
  return (
    <div className="feature-chip-grid">
      {features.map((feature) => {
        const active = value.includes(feature);
        return (
          <button
            key={feature}
            type="button"
            className={active ? 'is-active' : ''}
            onClick={() => onChange(active ? value.filter((item) => item !== feature) : [...value, feature])}
          >
            {translateOption(feature)}
          </button>
        );
      })}
    </div>
  );
}

function translateOption(option: string) {
  const labels: Record<string, string> = {
    almond: 'Миндальные',
    amber: 'Янтарные',
    aquiline: 'Орлиный',
    arched: 'Изогнутые',
    birthmark: 'Родимое пятно',
    black: 'Черные',
    blue: 'Голубые',
    brown: 'Карие',
    button: 'Кнопкой',
    downturned: 'Опущенные',
    fair: 'Светлый',
    flat: 'Плоский',
    freckles: 'Веснушки',
    full: 'Полные',
    glasses: 'Очки',
    gray: 'Серые',
    green: 'Зеленые',
    hazel: 'Ореховые',
    hooded: 'Нависающие',
    medium: 'Средний',
    mole: 'Родинка',
    narrow: 'Узкие',
    round: 'Круглые',
    scar: 'Шрам',
    sharp: 'Резкие',
    soft: 'Мягкие',
    straight: 'Прямые',
    thick: 'Густые',
    thin: 'Тонкие',
    upturned: 'Приподнятые',
    wide: 'Широкий',
  };
  return labels[option] || option.replaceAll('_', ' ');
}
