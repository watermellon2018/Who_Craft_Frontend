import React from 'react';
import {
  CameraOutlined,
  DownloadOutlined,
  RedoOutlined,
  ReloadOutlined,
  SyncOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import type {ViewAngle} from './CharacterViewport';
import type {EditableZone} from './zones';

interface Props {
  selectedZone: EditableZone | null;
  zoneParams: Record<string, number | string | boolean>;
  generationHistory?: React.ReactNode;
  hasChanges: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  // Undefined until the GL context is ready.
  onSnapshot?: () => void;
  onExportGlb?: () => void;
  // Camera presets + turntable — undefined until the GL context is ready.
  onSetView?: (angle: ViewAngle) => void;
  onToggleTurntable?: () => void;
  turntableOn?: boolean;
  onReset: () => void;
  onParameterChange: (zoneId: string, paramId: string, value: number | string | boolean) => void;
  onCancel: () => void;
  onApply: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
}

// Canonical reference angles surfaced as buttons. Short labels keep
// the chips compact; titles spell them out.
const VIEW_PRESETS: {angle: ViewAngle; labelKey: string; titleKey: string}[] = [
  {angle: 'front', labelKey: 'characterStudio3d.camera.front', titleKey: 'characterStudio3d.camera.frontTitle'},
  {angle: 'threeQuarter', labelKey: 'characterStudio3d.camera.threeQuarterShort', titleKey: 'characterStudio3d.camera.threeQuarter'},
  {angle: 'side', labelKey: 'characterStudio3d.camera.profile', titleKey: 'characterStudio3d.camera.profileTitle'},
];

// Slim bottom bar.
//   • Left:   global reset
//   • Center: quick color swatches for the selected zone IF it has a
//             material swatch parameter (e.g. hair color, eye color,
//             skin tone). Hidden otherwise — no faux "Быстрые цвета"
//             row when the zone has nothing to recolor.
//   • Right:  cancel / apply / save (also present in the inspector, but
//             also surfaced here so the user can act when no zone is
//             selected).
const BottomQuickBar: React.FC<Props> = ({
  selectedZone,
  generationHistory,
  zoneParams,
  hasChanges,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSnapshot,
  onExportGlb,
  onSetView,
  onToggleTurntable,
  turntableOn,
  onReset,
  onParameterChange,
  onCancel,
  onApply,
  onSave,
  saveDisabled = false,
}) => {
  const {t} = useTranslation();

  // Find the first swatch parameter on the selected zone — that's the
  // one the quick-color row mirrors.
  const swatchParam = selectedZone?.parameters?.find((p) => p.ui === 'swatch');
  const currentSwatchValue = swatchParam ? (zoneParams[swatchParam.id] as string | undefined) : undefined;

  return (
    <div className="c3d-bottom">
      <div className="c3d-bottom__left">
        <button type="button" className="c3d-bottom__chip" onClick={onReset} disabled={!hasChanges}>
          <ReloadOutlined />
          <span>{t('characterStudio3d.actions.reset')}</span>
        </button>
        <button
          type="button"
          className="c3d-bottom__chip c3d-bottom__chip--icon"
          onClick={onUndo}
          disabled={!canUndo}
          title={t('characterStudio3d.actions.undoShortcut')}
          aria-label={t('characterStudio3d.actions.undo')}
        >
          <UndoOutlined />
        </button>
        <button
          type="button"
          className="c3d-bottom__chip c3d-bottom__chip--icon"
          onClick={onRedo}
          disabled={!canRedo}
          title={t('characterStudio3d.actions.redoShortcut')}
          aria-label={t('characterStudio3d.actions.redo')}
        >
          <RedoOutlined />
        </button>
        <button
          type="button"
          className="c3d-bottom__chip c3d-bottom__chip--icon"
          onClick={onSnapshot}
          disabled={!onSnapshot}
          title={t('characterStudio3d.actions.snapshotPng')}
          aria-label={t('characterStudio3d.actions.snapshotPng')}
        >
          <CameraOutlined />
        </button>
        <button
          type="button"
          className="c3d-bottom__chip c3d-bottom__chip--icon"
          onClick={onExportGlb}
          disabled={!onExportGlb}
          title={t('characterStudio3d.actions.exportGlb')}
          aria-label={t('characterStudio3d.actions.exportGlb')}
        >
          <DownloadOutlined />
        </button>

        {/* Camera: canonical reference angles + turntable. These set up the
            shot the PNG snapshot above then captures. */}
        <span className="c3d-bottom__divider" aria-hidden="true" />
        <div className="c3d-preset-row" role="group" aria-label={t('characterStudio3d.camera.groupLabel')}>
          {VIEW_PRESETS.map(({angle, labelKey, titleKey}) => (
            <button
              key={angle}
              type="button"
              className="c3d-preset"
              onClick={() => onSetView?.(angle)}
              disabled={!onSetView}
              title={t(titleKey)}
              aria-label={t(titleKey)}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`c3d-bottom__chip c3d-bottom__chip--icon ${turntableOn ? 'c3d-bottom__chip--active' : ''}`}
          onClick={onToggleTurntable}
          disabled={!onToggleTurntable}
          title={t('characterStudio3d.camera.turntableTitle')}
          aria-label={t('characterStudio3d.camera.turntable')}
          aria-pressed={!!turntableOn}
        >
          <SyncOutlined spin={!!turntableOn} />
        </button>

      </div>

      <div className="c3d-bottom__center">
        {swatchParam ? (
          <div className="c3d-bottom__group">
            <span className="c3d-bottom__label">{t(swatchParam.translationKey)}</span>
            <div className="c3d-color-row">
              {swatchParam.options?.map((opt) => {
                const active = currentSwatchValue === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`c3d-color-pill ${active ? 'c3d-color-pill--active' : ''}`}
                    onClick={() => onParameterChange(selectedZone!.id, swatchParam.id, opt.value)}
                    aria-label={t(opt.translationKey)}
                    aria-pressed={active}
                    style={{background: opt.value}}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div className="c3d-bottom__group c3d-bottom__group--muted">
            <span className="c3d-bottom__label">
              {selectedZone
                ? t('characterStudio3d.bottomBar.noColorParameters')
                : t('characterStudio3d.bottomBar.selectZone')}
            </span>
          </div>
        )}
      </div>

      <div className="c3d-bottom__right">
        {generationHistory}
        <button type="button" className="c3d-bottom__ghost" onClick={onCancel}>
          {t('characterStudio3d.actions.cancel')}
        </button>
        <button
          type="button"
          className="c3d-bottom__secondary"
          onClick={onApply}
          disabled={!hasChanges}
        >
          {t('characterStudio3d.actions.apply')}
        </button>
        <button type="button" className="c3d-bottom__primary" onClick={onSave} disabled={saveDisabled}>
          <span>{t('characterStudio3d.actions.save')}</span>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M3 8 L7 12 L13 4"
              stroke="currentColor"
              strokeWidth={1.8}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default BottomQuickBar;
