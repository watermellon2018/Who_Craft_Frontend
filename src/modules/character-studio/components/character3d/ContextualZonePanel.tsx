import React from 'react';
import {CloseOutlined, ZoomInOutlined, ZoomOutOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import type {EditableParameter, EditableZone} from './zones';

interface Props {
  zone: EditableZone | null;
  ancestors: EditableZone[];
  zoneParams: Record<string, number | string | boolean>;
  symmetryEnabled: boolean;
  // 'L' | 'R' when a symmetric zone is edited with symmetry off; sliders
  // then read/write per-side overrides (`paramId__L` / `paramId__R`).
  editSide: 'L' | 'R' | null;
  onSideChange: (side: 'L' | 'R') => void;
  isZoomed: boolean;
  hasChanges: boolean;
  onSelectZone: (zoneId: string | null) => void;
  onClose: () => void;
  onParameterChange: (
    zoneId: string,
    paramId: string,
    value: number | string | boolean,
    side?: 'L' | 'R' | null,
  ) => void;
  onZoomToggle: () => void;
  onSymmetryToggle: () => void;
  onReset: () => void;
  onCancel: () => void;
  onApply: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
}

// Right-side contextual panel. Renders only when a zone is selected.
// Layout: pinned header / scrollable body (breadcrumb, subzones, params,
// symmetry, zoom) / pinned footer (cancel/apply/save).
const ContextualZonePanel: React.FC<Props> = ({
  zone,
  ancestors,
  zoneParams,
  symmetryEnabled,
  editSide,
  onSideChange,
  isZoomed,
  hasChanges,
  onSelectZone,
  onClose,
  onParameterChange,
  onZoomToggle,
  onSymmetryToggle,
  onReset,
  onCancel,
  onApply,
  onSave,
  saveDisabled = false,
}) => {
  const {t} = useTranslation();

  if (!zone) return null;

  return (
    <aside className="c3d-inspector" role="dialog" aria-label={t(zone.translationKey)}>
      <div className="c3d-inspector__leader" aria-hidden="true">
        <svg viewBox="0 0 240 60" preserveAspectRatio="none">
          <defs>
            <linearGradient id="leader-gradient" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgba(245, 180, 0, 0)" />
              <stop offset="100%" stopColor="rgba(245, 180, 0, 0.7)" />
            </linearGradient>
          </defs>
          <path
            d="M0 30 Q80 30 120 18 Q170 4 235 8"
            stroke="url(#leader-gradient)"
            strokeDasharray="3 6"
            strokeWidth="1.5"
            fill="none"
          />
          <circle cx="235" cy="8" r="3" fill="#F5B400" />
        </svg>
      </div>

      <header className="c3d-inspector__header">
        <div>
          <p className="c3d-inspector__eyebrow">{t('characterStudio3d.inspector.title')}</p>
          <h2 className="c3d-inspector__title">{t(zone.translationKey)}</h2>
        </div>
        <button
          type="button"
          className="c3d-inspector__close"
          onClick={onClose}
          aria-label={t('characterStudio3d.actions.close')}
        >
          <CloseOutlined />
        </button>
      </header>

      <div className="c3d-inspector__body custom-scrollbar">
        {ancestors.length > 1 ? (
          <ZoneBreadcrumbs ancestors={ancestors} onSelectZone={onSelectZone} />
        ) : null}

        {zone.children && zone.children.length > 0 ? (
          <ZoneChildrenList zone={zone} onSelectZone={onSelectZone} />
        ) : null}

        {zone.parameters && zone.parameters.length > 0 ? (
          <ZoneParameters
            zone={zone}
            zoneParams={zoneParams}
            editSide={editSide}
            onChange={(paramId, value, side) => onParameterChange(zone.id, paramId, value, side)}
            onReset={onReset}
          />
        ) : null}

        {zone.isSymmetric ? (
          <SymmetryToggle
            enabled={symmetryEnabled}
            onToggle={onSymmetryToggle}
            editSide={editSide}
            onSideChange={onSideChange}
          />
        ) : null}

        <ZoomControl
          isZoomed={isZoomed}
          zoneLabel={t(zone.translationKey)}
          onToggle={onZoomToggle}
        />
      </div>

      <footer className="c3d-inspector__footer">
        <button type="button" className="c3d-inspector__btn c3d-inspector__btn--ghost" onClick={onCancel}>
          {t('characterStudio3d.actions.cancel')}
        </button>
        <button
          type="button"
          className="c3d-inspector__btn c3d-inspector__btn--secondary"
          onClick={onApply}
          disabled={!hasChanges}
        >
          {t('characterStudio3d.actions.apply')}
        </button>
        <button type="button" className="c3d-inspector__btn c3d-inspector__btn--primary" onClick={onSave} disabled={saveDisabled}>
          {t('characterStudio3d.actions.save')}
        </button>
      </footer>
    </aside>
  );
};

// ─────────── Breadcrumbs ───────────
const ZoneBreadcrumbs: React.FC<{ancestors: EditableZone[]; onSelectZone: (id: string | null) => void}> = ({
  ancestors,
  onSelectZone,
}) => {
  const {t} = useTranslation();

  return (
    <nav className="c3d-breadcrumbs" aria-label={t('characterStudio3d.inspector.breadcrumbsLabel')}>
      {ancestors.map((zone, index) => {
        const isLast = index === ancestors.length - 1;
        return (
          <React.Fragment key={zone.id}>
            {isLast ? (
              <span className="c3d-breadcrumbs__item c3d-breadcrumbs__item--current">
                {t(zone.translationKey)}
              </span>
            ) : (
              <button
                type="button"
                className="c3d-breadcrumbs__item c3d-breadcrumbs__item--link"
                onClick={() => onSelectZone(zone.id)}
              >
                {t(zone.translationKey)}
              </button>
            )}
            {!isLast ? <span className="c3d-breadcrumbs__sep" aria-hidden="true">›</span> : null}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

// ─────────── Subzones list ───────────
const ZoneChildrenList: React.FC<{zone: EditableZone; onSelectZone: (id: string) => void}> = ({
  zone,
  onSelectZone,
}) => {
  const {t} = useTranslation();

  return (
    <section className="c3d-panel-section">
      <h3 className="c3d-panel-section__title">{t('characterStudio3d.inspector.subzonesTitle')}</h3>
      <ul className="c3d-subzone-list">
        {zone.children!.map((child) => (
          <li key={child.id}>
            <button
              type="button"
              className="c3d-subzone-item"
              onClick={() => onSelectZone(child.id)}
            >
              <span className="c3d-subzone-item__label">{t(child.translationKey)}</span>
              {child.children?.length ? (
                <span className="c3d-subzone-item__hint">
                  {t('characterStudio3d.inspector.subzonesCount', {count: child.children.length})}
                </span>
              ) : child.parameters?.length ? (
                <span className="c3d-subzone-item__hint">
                  {t('characterStudio3d.inspector.parametersCount', {count: child.parameters.length})}
                </span>
              ) : null}
              <span className="c3d-subzone-item__arrow" aria-hidden="true">›</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

// ─────────── Parameters ───────────
const ZoneParameters: React.FC<{
  zone: EditableZone;
  zoneParams: Record<string, number | string | boolean>;
  editSide: 'L' | 'R' | null;
  onChange: (paramId: string, value: number | string | boolean, side?: 'L' | 'R' | null) => void;
  onReset: () => void;
}> = ({zone, zoneParams, editSide, onChange, onReset}) => {
  const {t} = useTranslation();

  return (
    <section className="c3d-panel-section">
      <div className="c3d-panel-section__head">
        <h3 className="c3d-panel-section__title">
          {t('characterStudio3d.inspector.parametersTitle')}
          {editSide ? (
            <span className="c3d-panel-section__badge">
              {editSide === 'L'
                ? t('characterStudio3d.symmetry.leftSide')
                : t('characterStudio3d.symmetry.rightSide')}
            </span>
          ) : null}
        </h3>
        <button type="button" className="c3d-section-link" onClick={onReset}>
          {t('characterStudio3d.actions.reset')}
        </button>
      </div>
      <div className="c3d-param-list">
        {zone.parameters!.map((param) => {
          // Only numeric shape controls are side-aware; colors, presets and
          // toggles always apply to both halves.
          const sided = !!editSide && (param.ui === 'slider' || param.ui === 'drag');
          const value = sided
            ? zoneParams[`${param.id}__${editSide}`] ?? zoneParams[param.id] ?? param.defaultValue
            : zoneParams[param.id] ?? param.defaultValue;
          return (
            <ParameterControl
              key={sided ? `${param.id}__${editSide}` : param.id}
              param={param}
              value={value}
              onChange={(v) => onChange(param.id, v, sided ? editSide : null)}
            />
          );
        })}
      </div>
    </section>
  );
};

const ParameterControl: React.FC<{
  param: EditableParameter;
  value: number | string | boolean;
  onChange: (value: number | string | boolean) => void;
}> = ({param, value, onChange}) => {
  switch (param.ui) {
    case 'slider':
    case 'drag':
      return <SliderControl param={param} value={value as number} onChange={onChange} />;
    case 'swatch':
      return <SwatchControl param={param} value={value as string} onChange={onChange} />;
    case 'preset':
      return <PresetControl param={param} value={value as string} onChange={onChange} />;
    case 'toggle':
      return <ToggleControl param={param} value={!!value} onChange={onChange} />;
    default:
      return null;
  }
};

const SliderControl: React.FC<{
  param: EditableParameter;
  value: number;
  onChange: (v: number) => void;
}> = ({param, value, onChange}) => {
  const {t} = useTranslation();
  const min = param.min ?? -1;
  const max = param.max ?? 1;
  const step = param.step ?? 0.05;
  const norm = (value - min) / (max - min || 1);
  const display = param.min === 0 ? Math.round(value * 100) : Math.round(value * 100);
  return (
    <div className="c3d-param-row">
      <div className="c3d-param-row__label">
        <span>{t(param.translationKey)}</span>
        <strong>{value > 0 && param.min === -1 ? `+${display}` : display}</strong>
      </div>
      <input
        type="range"
        className="c3d-param-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{['--c3d-slider-fill' as never]: `${norm * 100}%`}}
        aria-label={t(param.translationKey)}
      />
      {param.ui === 'drag' && param.hintTranslationKey ? (
        <small className="c3d-param-row__hint">{t(param.hintTranslationKey)}</small>
      ) : null}
    </div>
  );
};

const SwatchControl: React.FC<{
  param: EditableParameter;
  value: string;
  onChange: (v: string) => void;
}> = ({param, value, onChange}) => {
  const {t} = useTranslation();

  return (
    <div className="c3d-param-row">
      <div className="c3d-param-row__label">
        <span>{t(param.translationKey)}</span>
      </div>
      <div className="c3d-swatch-grid">
        {param.options?.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              className={`c3d-swatch ${active ? 'c3d-swatch--active' : ''}`}
              onClick={() => onChange(opt.value)}
              aria-label={t(opt.translationKey)}
              aria-pressed={active}
            >
              <span className="c3d-swatch__dot" style={{background: opt.value}} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

const PresetControl: React.FC<{
  param: EditableParameter;
  value: string;
  onChange: (v: string) => void;
}> = ({param, value, onChange}) => {
  const {t} = useTranslation();

  return (
    <div className="c3d-param-row">
      <div className="c3d-param-row__label">
        <span>{t(param.translationKey)}</span>
      </div>
      <div className="c3d-segment">
        {param.options?.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              className={`c3d-segment__item ${active ? 'c3d-segment__item--active' : ''}`}
              onClick={() => onChange(opt.value)}
            >
              {t(opt.translationKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const ToggleControl: React.FC<{
  param: EditableParameter;
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({param, value, onChange}) => {
  const {t} = useTranslation();

  return (
    <label className="c3d-param-toggle">
      <span>{t(param.translationKey)}</span>
      <button
        type="button"
        className={`c3d-toggle ${value ? 'c3d-toggle--on' : ''}`}
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
      >
        <span className="c3d-toggle__knob" />
      </button>
    </label>
  );
};

// ─────────── Symmetry toggle ───────────
const SymmetryToggle: React.FC<{
  enabled: boolean;
  onToggle: () => void;
  editSide: 'L' | 'R' | null;
  onSideChange: (side: 'L' | 'R') => void;
}> = ({enabled, onToggle, editSide, onSideChange}) => {
  const {t} = useTranslation();

  const sides = [
    {key: 'L' as const, translationKey: 'characterStudio3d.symmetry.left'},
    {key: 'R' as const, translationKey: 'characterStudio3d.symmetry.right'},
  ];

  return (
    <section className="c3d-panel-section c3d-symmetry">
      <div className="c3d-symmetry__row">
        <div className="c3d-symmetry__copy">
          <strong>{t('characterStudio3d.symmetry.title')}</strong>
          <small>
            {enabled
              ? t('characterStudio3d.symmetry.enabledHint')
              : t('characterStudio3d.symmetry.disabledHint')}
          </small>
        </div>
        <button
          type="button"
          className={`c3d-toggle ${enabled ? 'c3d-toggle--on' : ''}`}
          onClick={onToggle}
          role="switch"
          aria-checked={enabled}
        >
          <span className="c3d-toggle__knob" />
        </button>
      </div>
      {!enabled ? (
        <div className="c3d-symmetry__sides">
          <div
            className="c3d-segment"
            role="radiogroup"
            aria-label={t('characterStudio3d.symmetry.sideLabel')}
          >
            {sides.map(({key, translationKey}) => (
              <button
                key={key}
                type="button"
                className={`c3d-segment__item ${editSide === key ? 'c3d-segment__item--active' : ''}`}
                onClick={() => onSideChange(key)}
                role="radio"
                aria-checked={editSide === key}
              >
                {t(translationKey)}
              </button>
            ))}
          </div>
          <small className="c3d-symmetry__hint">
            {t('characterStudio3d.symmetry.modelHint')}
          </small>
        </div>
      ) : null}
    </section>
  );
};

// ─────────── Zoom toggle ───────────
const ZoomControl: React.FC<{isZoomed: boolean; zoneLabel: string; onToggle: () => void}> = ({
  isZoomed,
  zoneLabel,
  onToggle,
}) => {
  const {t} = useTranslation();

  return (
    <section className="c3d-panel-section">
      <button type="button" className="c3d-zoom-button" onClick={onToggle}>
        {isZoomed ? <ZoomOutOutlined /> : <ZoomInOutlined />}
        <span>
          {isZoomed
            ? t('characterStudio3d.zoom.exit')
            : t('characterStudio3d.zoom.enter')}
        </span>
        {!isZoomed ? <em>{zoneLabel}</em> : null}
      </button>
    </section>
  );
};

export default ContextualZonePanel;
