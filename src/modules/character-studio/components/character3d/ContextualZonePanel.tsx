import React from 'react';
import {CloseOutlined, ZoomInOutlined, ZoomOutOutlined} from '@ant-design/icons';
import {EditableZone, EditableParameter} from './zones';

interface Props {
  zone: EditableZone | null;
  ancestors: EditableZone[];
  zoneParams: Record<string, number | string | boolean>;
  symmetryEnabled: boolean;
  isZoomed: boolean;
  hasChanges: boolean;
  onSelectZone: (zoneId: string | null) => void;
  onClose: () => void;
  onParameterChange: (zoneId: string, paramId: string, value: number | string | boolean) => void;
  onZoomToggle: () => void;
  onSymmetryToggle: () => void;
  onReset: () => void;
  onCancel: () => void;
  onApply: () => void;
  onSave: () => void;
}

// Right-side contextual panel. Renders only when a zone is selected.
// Layout: pinned header / scrollable body (breadcrumb, subzones, params,
// symmetry, zoom) / pinned footer (cancel/apply/save).
const ContextualZonePanel: React.FC<Props> = ({
  zone,
  ancestors,
  zoneParams,
  symmetryEnabled,
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
}) => {
  if (!zone) return null;

  return (
    <aside className="c3d-inspector" role="dialog" aria-label={zone.label}>
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
          <p className="c3d-inspector__eyebrow">Контекстная панель</p>
          <h2 className="c3d-inspector__title">{zone.label}</h2>
        </div>
        <button type="button" className="c3d-inspector__close" onClick={onClose} aria-label="Закрыть">
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
            onChange={(paramId, value) => onParameterChange(zone.id, paramId, value)}
            onReset={onReset}
          />
        ) : null}

        {zone.isSymmetric ? (
          <SymmetryToggle enabled={symmetryEnabled} onToggle={onSymmetryToggle} />
        ) : null}

        <ZoomControl isZoomed={isZoomed} zoneLabel={zone.label} onToggle={onZoomToggle} />
      </div>

      <footer className="c3d-inspector__footer">
        <button type="button" className="c3d-inspector__btn c3d-inspector__btn--ghost" onClick={onCancel}>
          Отмена
        </button>
        <button
          type="button"
          className="c3d-inspector__btn c3d-inspector__btn--secondary"
          onClick={onApply}
          disabled={!hasChanges}
        >
          Применить
        </button>
        <button type="button" className="c3d-inspector__btn c3d-inspector__btn--primary" onClick={onSave}>
          Сохранить
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
  return (
    <nav className="c3d-breadcrumbs" aria-label="Иерархия зоны">
      {ancestors.map((zone, index) => {
        const isLast = index === ancestors.length - 1;
        return (
          <React.Fragment key={zone.id}>
            {isLast ? (
              <span className="c3d-breadcrumbs__item c3d-breadcrumbs__item--current">{zone.label}</span>
            ) : (
              <button
                type="button"
                className="c3d-breadcrumbs__item c3d-breadcrumbs__item--link"
                onClick={() => onSelectZone(zone.id)}
              >
                {zone.label}
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
  return (
    <section className="c3d-panel-section">
      <h3 className="c3d-panel-section__title">Подзоны</h3>
      <ul className="c3d-subzone-list">
        {zone.children!.map((child) => (
          <li key={child.id}>
            <button
              type="button"
              className="c3d-subzone-item"
              onClick={() => onSelectZone(child.id)}
            >
              <span className="c3d-subzone-item__label">{child.label}</span>
              {child.children?.length ? (
                <span className="c3d-subzone-item__hint">{child.children.length} подзон</span>
              ) : child.parameters?.length ? (
                <span className="c3d-subzone-item__hint">{child.parameters.length} парам.</span>
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
  onChange: (paramId: string, value: number | string | boolean) => void;
  onReset: () => void;
}> = ({zone, zoneParams, onChange, onReset}) => {
  return (
    <section className="c3d-panel-section">
      <div className="c3d-panel-section__head">
        <h3 className="c3d-panel-section__title">Параметры</h3>
        <button type="button" className="c3d-section-link" onClick={onReset}>
          Сбросить
        </button>
      </div>
      <div className="c3d-param-list">
        {zone.parameters!.map((param) => (
          <ParameterControl
            key={param.id}
            param={param}
            value={zoneParams[param.id] ?? param.defaultValue}
            onChange={(v) => onChange(param.id, v)}
          />
        ))}
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
  const min = param.min ?? -1;
  const max = param.max ?? 1;
  const step = param.step ?? 0.05;
  const norm = (value - min) / (max - min || 1);
  const display = param.min === 0 ? Math.round(value * 100) : Math.round(value * 100);
  return (
    <div className="c3d-param-row">
      <div className="c3d-param-row__label">
        <span>{param.label}</span>
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
        aria-label={param.label}
      />
      {param.ui === 'drag' && param.hint ? (
        <small className="c3d-param-row__hint">{param.hint}</small>
      ) : null}
    </div>
  );
};

const SwatchControl: React.FC<{
  param: EditableParameter;
  value: string;
  onChange: (v: string) => void;
}> = ({param, value, onChange}) => {
  return (
    <div className="c3d-param-row">
      <div className="c3d-param-row__label">
        <span>{param.label}</span>
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
              aria-label={opt.label}
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
  return (
    <div className="c3d-param-row">
      <div className="c3d-param-row__label">
        <span>{param.label}</span>
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
              {opt.label}
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
  return (
    <label className="c3d-param-toggle">
      <span>{param.label}</span>
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
const SymmetryToggle: React.FC<{enabled: boolean; onToggle: () => void}> = ({enabled, onToggle}) => {
  return (
    <section className="c3d-panel-section c3d-symmetry">
      <div className="c3d-symmetry__row">
        <div className="c3d-symmetry__copy">
          <strong>Применять симметрично</strong>
          <small>
            {enabled
              ? 'Изменения применяются к обеим сторонам'
              : 'Редактируется только выбранная сторона'}
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
    </section>
  );
};

// ─────────── Zoom toggle ───────────
const ZoomControl: React.FC<{isZoomed: boolean; zoneLabel: string; onToggle: () => void}> = ({
  isZoomed,
  zoneLabel,
  onToggle,
}) => {
  return (
    <section className="c3d-panel-section">
      <button type="button" className="c3d-zoom-button" onClick={onToggle}>
        {isZoomed ? <ZoomOutOutlined /> : <ZoomInOutlined />}
        <span>{isZoomed ? 'Выйти из приближения' : 'Приблизить'}</span>
        {!isZoomed ? <em>{zoneLabel}</em> : null}
      </button>
    </section>
  );
};

export default ContextualZonePanel;
