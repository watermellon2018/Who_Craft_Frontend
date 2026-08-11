import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Image} from 'antd';
import {useTranslation} from 'react-i18next';

import {CharacterImageType, CharacterVariant, CharacterViewMode, StudioCharacter, ZoneSelection} from '../types/character.types';
import {AssetJobsMap, AssetJobStatus} from '../hooks/useCharacterAssetJobs';
import FullBodyCanvas from './FullBodyCanvas';


export interface ZoneEditState {
  selection: ZoneSelection;
  instruction: string;
}

interface Props {
  character?: StudioCharacter | null;
  selectedVariant?: CharacterVariant | null;
  activeViewMode: CharacterViewMode;
  onViewModeChange: (value: CharacterViewMode) => void;
  onGenerateImage: () => void;
  generatingImageType?: CharacterImageType | null;
  jobProgress?: number;
  secondaryJobs?: AssetJobsMap;
  onRetrySecondary?: (type: CharacterImageType) => void;
  zoneEditOpen?: boolean;
  onZoneEditToggle?: (open: boolean) => void;
  // Called when user clicks "Apply" — fires generation.
  onZoneEditApply?: (state: ZoneEditState) => Promise<void> | void;
  zoneEditSubmitting?: boolean;
  // The current saved zone state (selection + instruction), controlled from parent.
  savedZone?: ZoneEditState | null;
  // Called when user commits a zone+instruction via OK.
  onZoneSave?: (state: ZoneEditState) => void;
  // Total saved zones across all formats — used for badge on the toggle button.
  pendingZoneCount?: number;
}

function buildViewTabs(t: (key: string) => string): Array<{label: string; value: CharacterViewMode}> {
  return [
    {label: t('characterStudio.preview.tabPortrait'), value: 'portrait'},
    {label: t('characterStudio.preview.tabFullBody'), value: 'fullBody'},
    {label: t('characterStudio.preview.tabScene'), value: 'scene'},
  ];
}

export default function CharacterPreview({
  character,
  selectedVariant,
  activeViewMode,
  onViewModeChange,
  onGenerateImage,
  generatingImageType,
  jobProgress,
  secondaryJobs,
  onRetrySecondary,
  zoneEditOpen,
  onZoneEditToggle,
  onZoneEditApply,
  zoneEditSubmitting,
  savedZone,
  onZoneSave,
  pendingZoneCount = 0,
}: Props) {
  const {t} = useTranslation();
  const viewTabs = useMemo(() => buildViewTabs(t), [t]);
  const imageType = viewModeToImageType(activeViewMode);
  const reference = getPreviewImage(character, selectedVariant, imageType);
  const previewKey =
    (selectedVariant?.region === REGION_BY_IMAGE_TYPE[imageType] && selectedVariant?.variant_id) ||
    character?.images?.[imageType]?.asset_id ||
    reference ||
    'empty';
  const [imageBroken, setImageBroken] = useState(false);
  const currentSecondaryJob = secondaryJobs?.[imageType];
  const secondaryStatus: AssetJobStatus | undefined = currentSecondaryJob?.status;
  const isSecondaryActive = secondaryStatus === 'queued' || secondaryStatus === 'processing';
  const isSecondaryFailed = secondaryStatus === 'failed';
  const isGeneratingCurrent =
    generatingImageType === imageType || (imageType !== 'portrait' && isSecondaryActive);
  const hasImage = !!reference && !imageBroken;
  const canInteractWithImage = hasImage && !isGeneratingCurrent && !isSecondaryFailed;
  const canZoneEdit = canInteractWithImage && !generatingImageType;

  // --- Drawing state (transient — not yet committed) ---
  const subjectRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{x: number; y: number} | null>(null);
  const [drawingSelection, setDrawingSelection] = useState<ZoneSelection | null>(null);
  // Whether popover is open (to type the instruction).
  const [popoverOpen, setPopoverOpen] = useState(false);
  // Draft instruction text inside the popover.
  const [draftInstruction, setDraftInstruction] = useState('');

  // When zone-edit mode is closed externally, collapse everything.
  useEffect(() => {
    if (!zoneEditOpen) {
      setDrawingSelection(null);
      setPopoverOpen(false);
      setDraftInstruction('');
      dragStartRef.current = null;
    }
  }, [zoneEditOpen]);

  // When active view mode changes, collapse the popover but keep saved zone
  // (it lives in parent, keyed per mode).
  useEffect(() => {
    setDrawingSelection(null);
    setPopoverOpen(false);
    setDraftInstruction('');
    dragStartRef.current = null;
  }, [activeViewMode]);

  // When the parent clears savedZone (after successful generation), also reset
  // local drawing state so the dashed rectangle disappears.
  const prevSavedZoneRef = useRef<ZoneEditState | null | undefined>(undefined);
  useEffect(() => {
    const prev = prevSavedZoneRef.current;
    prevSavedZoneRef.current = savedZone ?? null;
    // Transition from a saved zone → null means the zone was consumed (applied).
    if (prev != null && savedZone == null) {
      setDrawingSelection(null);
      setPopoverOpen(false);
      setDraftInstruction('');
    }
  }, [savedZone]);

  useEffect(() => {
    setImageBroken(false);
  }, [reference]);

  // Esc closes popover or zone-edit mode.
  useEffect(() => {
    if (!zoneEditOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (popoverOpen) {
          setPopoverOpen(false);
        } else {
          onZoneEditToggle?.(false);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoneEditOpen, popoverOpen, onZoneEditToggle]);

  const computeNormalized = (clientX: number, clientY: number) => {
    const el = subjectRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!zoneEditOpen || !hasImage) return;
    // Close popover and start a new draw only if not clicking the popover itself.
    if ((e.target as Element).closest('.zone-edit-popover')) return;
    const start = computeNormalized(e.clientX, e.clientY);
    if (!start) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragStartRef.current = start;
    setPopoverOpen(false);
    setDrawingSelection({x: start.x, y: start.y, width: 0, height: 0});
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!zoneEditOpen || !dragStartRef.current) return;
    const cur = computeNormalized(e.clientX, e.clientY);
    if (!cur) return;
    const sx = dragStartRef.current.x;
    const sy = dragStartRef.current.y;
    setDrawingSelection({
      x: Math.min(sx, cur.x),
      y: Math.min(sy, cur.y),
      width: Math.abs(cur.x - sx),
      height: Math.abs(cur.y - sy),
    });
  };

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStartRef.current) return;
      dragStartRef.current = null;
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      setDrawingSelection((sel) => {
        if (!sel) return sel;
        if (sel.width < 0.015 || sel.height < 0.015) return null;
        // Finished drawing — open the popover.
        setDraftInstruction(savedZone?.instruction ?? '');
        setPopoverOpen(true);
        return sel;
      });
    },
    [savedZone?.instruction],
  );

  // Click on the saved-zone marker → reopen popover with saved text.
  const handleMarkerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!savedZone) return;
    setDrawingSelection(savedZone.selection);
    setDraftInstruction(savedZone.instruction);
    setPopoverOpen(true);
  };

  const handlePopoverOk = () => {
    const trimmed = draftInstruction.trim();
    if (!trimmed || !drawingSelection) return;
    onZoneSave?.({selection: drawingSelection, instruction: trimmed});
    setPopoverOpen(false);
  };

  const handlePopoverCancel = () => {
    setPopoverOpen(false);
    setDrawingSelection(null);
  };

  // The selection to render visually: drawing (in progress) or saved zone.
  const visibleSelection = drawingSelection ?? (zoneEditOpen ? savedZone?.selection ?? null : null);

  const canApply = !!savedZone?.instruction.trim() && !!savedZone?.selection && !zoneEditSubmitting;

  return (
    <section className={`character-preview character-preview--${activeViewMode}`}>
      <div className="character-preview-tabs" role="tablist" aria-label="Режим просмотра">
        {viewTabs.map((tab) => {
          const tabImageType = viewModeToImageType(tab.value);
          const tabStatus = getTabStatus(tabImageType, character, secondaryJobs, generatingImageType);
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              className={`character-preview-tabs__item${activeViewMode === tab.value ? ' character-preview-tabs__item--active' : ''}`}
              onClick={() => onViewModeChange(tab.value)}
            >
              <span>{tab.label}</span>
              <TabStatusDot status={tabStatus} />
            </button>
          );
        })}
        {onZoneEditToggle && canZoneEdit && (
          <button
            type="button"
            className={`character-preview-tabs__zone-edit${zoneEditOpen ? ' character-preview-tabs__zone-edit--active' : ''}`}
            onClick={() => onZoneEditToggle(!zoneEditOpen)}
            aria-pressed={zoneEditOpen}
            title="Выделите прямоугольную область и опишите изменение"
            style={{position: 'relative'}}
          >
            {zoneEditOpen ? 'Закрыть зону' : 'Редактировать по зоне'}
            {pendingZoneCount > 0 && (
              <span
                aria-label={`${pendingZoneCount} активных зон`}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 9,
                  background: 'var(--craft-accent)',
                  color: '#000',
                  fontSize: 11,
                  fontWeight: 700,
                  lineHeight: '18px',
                  textAlign: 'center',
                  pointerEvents: 'none',
                  boxSizing: 'border-box',
                }}
              >
                {pendingZoneCount}
              </span>
            )}
          </button>
        )}
      </div>

      <div className={`character-preview-stage character-preview-stage--${activeViewMode}`}>
        {activeViewMode === 'scene' && <SceneBackdrop />}
        <div
          ref={subjectRef}
          className={`character-preview-subject character-preview-subject--${activeViewMode}${zoneEditOpen && canInteractWithImage ? ' character-preview-subject--zone-edit' : ''}`}
          onPointerDown={zoneEditOpen && canInteractWithImage ? handlePointerDown : undefined}
          onPointerMove={zoneEditOpen && canInteractWithImage ? handlePointerMove : undefined}
          onPointerUp={zoneEditOpen && canInteractWithImage ? handlePointerUp : undefined}
          style={
            zoneEditOpen && canInteractWithImage
              ? {position: 'relative', cursor: 'crosshair', userSelect: 'none', touchAction: 'none'}
              : {position: 'relative'}
          }
        >
          {isGeneratingCurrent ? (
            <GeneratingState viewMode={activeViewMode} progress={jobProgress ?? currentSecondaryJob?.progress} />
          ) : isSecondaryFailed ? (
            <FailedState
              viewMode={activeViewMode}
              errorMessage={currentSecondaryJob?.errorMessage}
              onRetry={() => onRetrySecondary?.(imageType)}
            />
          ) : reference && !imageBroken && activeViewMode === 'fullBody' ? (
            <FullBodyCanvas
              imageUrl={reference}
              onImageError={() => setImageBroken(true)}
            />
          ) : reference && !imageBroken ? (
            <Image
              key={previewKey}
              src={reference}
              alt={t('characterStudio.preview.altCharacterPreview')}
              preview={false}
              onError={() => setImageBroken(true)}
            />
          ) : (
            <div className={`character-preview-empty character-preview-empty--${activeViewMode}`}>
              <div className="character-preview-empty__silhouette" />
              <h3>{emptyCopyByMode[activeViewMode].title}</h3>
              <p>{emptyCopyByMode[activeViewMode].text}</p>
              <div className="character-preview-empty__actions">
                <button type="button" onClick={onGenerateImage} disabled={!!generatingImageType}>
                  Сгенерировать этот режим
                </button>
              </div>
            </div>
          )}

          {/* Zone-edit loading overlay — shown on top of existing image during generation */}
          {zoneEditSubmitting && hasImage && (
            <ZoneEditLoadingOverlay />
          )}

          {/* Selection rectangle — hidden while submitting */}
          {zoneEditOpen && hasImage && !zoneEditSubmitting && visibleSelection && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: `${visibleSelection.x * 100}%`,
                top: `${visibleSelection.y * 100}%`,
                width: `${visibleSelection.width * 100}%`,
                height: `${visibleSelection.height * 100}%`,
                border: '2px dashed var(--craft-accent)',
                background: 'rgba(250,176,5,0.12)',
                pointerEvents: 'none',
                boxSizing: 'border-box',
              }}
            />
          )}

          {/* Zone marker — shown when a prompt is saved and popover is closed */}
          {zoneEditOpen && hasImage && savedZone && !popoverOpen && !zoneEditSubmitting && (
            <ZoneMarker zone={savedZone} onClick={handleMarkerClick} />
          )}

          {/* Floating popover — shown while drawing selection or editing prompt */}
          {zoneEditOpen && hasImage && drawingSelection && popoverOpen && !zoneEditSubmitting && (
            <ZonePopover
              selection={drawingSelection}
              instruction={draftInstruction}
              onInstructionChange={setDraftInstruction}
              onOk={handlePopoverOk}
              onCancel={handlePopoverCancel}
              containerRef={subjectRef}
            />
          )}

          {/* Hint strip at the bottom of the image when no zone is drawn yet */}
          {zoneEditOpen && hasImage && !savedZone && !drawingSelection && !zoneEditSubmitting && (
            <div
              aria-live="polite"
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '8px 14px',
                background: 'rgba(0,0,0,0.6)',
                color: '#aaa',
                fontSize: 12,
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              Нарисуйте область мышью, затем введите инструкцию
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar — shown only when there is a saved zone to apply */}
      {zoneEditOpen && hasImage && savedZone && (
        <div
          className="character-preview-zone-bar"
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #2b2b2b',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: '#141414',
          }}
        >
          <span
            style={{
              color: '#ccc',
              fontSize: 13,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={savedZone.instruction}
          >
            ✏️ «{savedZone.instruction}»
          </span>
          <button
            type="button"
            onClick={() => savedZone && onZoneEditApply?.(savedZone)}
            disabled={!canApply}
            style={{
              flexShrink: 0,
              padding: '8px 20px',
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 6,
              border: 'none',
              cursor: canApply ? 'pointer' : 'not-allowed',
              background: canApply ? 'var(--craft-accent)' : '#555',
              color: canApply ? '#000' : '#999',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'background 0.15s',
            }}
          >
            {zoneEditSubmitting && (
              <span
                style={{
                  display: 'inline-block',
                  width: 13,
                  height: 13,
                  border: '2px solid #000',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'zone-edit-spin 0.7s linear infinite',
                }}
              />
            )}
            {zoneEditSubmitting ? 'Применяем…' : 'Применить'}
          </button>
          <button
            type="button"
            onClick={() => onZoneEditToggle?.(false)}
            disabled={zoneEditSubmitting}
            style={{
              flexShrink: 0,
              padding: '8px 14px',
              fontSize: 14,
              fontWeight: 500,
              borderRadius: 6,
              border: '1px solid #444',
              cursor: zoneEditSubmitting ? 'not-allowed' : 'pointer',
              background: 'transparent',
              color: zoneEditSubmitting ? '#555' : '#aaa',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            Отмена
          </button>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// ZoneEditLoadingOverlay — translucent overlay with spinner + progress bar

function ZoneEditLoadingOverlay() {
  return (
    <div
      aria-label="Применяем изменения…"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        zIndex: 15,
        borderRadius: 'inherit',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: '3px solid rgba(250,176,5,0.3)',
          borderTopColor: 'var(--craft-accent)',
          borderRadius: '50%',
          animation: 'zone-edit-spin 0.7s linear infinite',
        }}
      />
      <span style={{color: 'var(--craft-accent)', fontSize: 14, fontWeight: 600, letterSpacing: 0.3}}>
        Применяем изменения…
      </span>
      <div
        style={{
          width: '60%',
          height: 3,
          background: 'rgba(250,176,5,0.2)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            background: 'var(--craft-accent)',
            borderRadius: 2,
            animation: 'zone-edit-progress 1.4s ease-in-out infinite',
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ZoneMarker — small icon at center of saved zone

function ZoneMarker({zone, onClick}: {zone: ZoneEditState; onClick: (e: React.MouseEvent) => void}) {
  const cx = zone.selection.x + zone.selection.width / 2;
  const cy = zone.selection.y + zone.selection.height / 2;
  return (
    <button
      type="button"
      className="zone-edit-marker"
      title={zone.instruction}
      onClick={onClick}
      style={{
        position: 'absolute',
        left: `${cx * 100}%`,
        top: `${cy * 100}%`,
        transform: 'translate(-50%, -50%)',
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: 'var(--craft-accent)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        lineHeight: 1,
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        zIndex: 10,
        padding: 0,
      }}
      aria-label="Редактировать инструкцию зоны"
    >
      ✏️
    </button>
  );
}

// ---------------------------------------------------------------------------
// ZonePopover — floating input near the selection rect

interface ZonePopoverProps {
  selection: ZoneSelection;
  instruction: string;
  onInstructionChange: (v: string) => void;
  onOk: () => void;
  onCancel: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const POPOVER_WIDTH = 260;
const POPOVER_OFFSET = 8; // px gap between rect edge and popover

function ZonePopover({
  selection,
  instruction,
  onInstructionChange,
  onOk,
  onCancel,
  containerRef,
}: ZonePopoverProps) {
  const {t} = useTranslation();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // Auto-focus the textarea when popover opens.
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  // Compute pixel position relative to container.
  const container = containerRef.current;
  const containerWidth = container?.clientWidth ?? 400;
  const containerHeight = container?.clientHeight ?? 400;

  // Preferred: right of selection.
  const selRight = (selection.x + selection.width) * containerWidth;
  const selTop = selection.y * containerHeight;
  const selCenterY = (selection.y + selection.height / 2) * containerHeight;

  let left: number;
  let top: number;

  // Try placing right of selection; flip to left if it would overflow.
  if (selRight + POPOVER_OFFSET + POPOVER_WIDTH <= containerWidth) {
    left = selRight + POPOVER_OFFSET;
  } else {
    left = selection.x * containerWidth - POPOVER_WIDTH - POPOVER_OFFSET;
  }
  // Clamp left within container.
  left = Math.max(4, Math.min(containerWidth - POPOVER_WIDTH - 4, left));

  // Vertically center on selection, clamp to container.
  top = selCenterY - 60;
  const estimatedHeight = 140;
  top = Math.max(4, Math.min(containerHeight - estimatedHeight - 4, top));

  // If selection is very tall, anchor to its top instead.
  if (selTop + estimatedHeight < containerHeight) {
    top = Math.max(4, Math.min(containerHeight - estimatedHeight - 4, selTop));
  }

  return (
    <div
      className="zone-edit-popover"
      role="dialog"
      aria-label={t('characterStudio.zoneEdit.dialogLabel')}
      style={{
        position: 'absolute',
        left,
        top,
        width: POPOVER_WIDTH,
        background: '#1a1a1a',
        border: '1px solid #3a3a3a',
        borderRadius: 8,
        padding: '10px 12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        zIndex: 20,
        boxSizing: 'border-box',
      }}
      // Prevent pointer events from propagating to the drawing canvas beneath.
      onPointerDown={(e) => e.stopPropagation()}
    >
      <label
        htmlFor="zone-popover-instruction"
        style={{display: 'block', marginBottom: 6, fontSize: 12, color: '#ccc', fontWeight: 600}}
      >
        {t('characterStudio.zoneEdit.question')}
      </label>
      <textarea
        id="zone-popover-instruction"
        ref={inputRef}
        value={instruction}
        onChange={(e) => onInstructionChange(e.target.value)}
        placeholder={t('characterStudio.zoneEdit.placeholder')}
        maxLength={500}
        rows={3}
        style={{
          width: '100%',
          resize: 'none',
          boxSizing: 'border-box',
          fontSize: 12,
          background: '#111',
          border: '1px solid #3a3a3a',
          borderRadius: 4,
          color: '#fff',
          padding: '6px 8px',
          lineHeight: 1.5,
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            onOk();
          }
        }}
      />
      <div style={{display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end'}}>
        <button
          type="button"
          onClick={onCancel}
          style={{padding: '4px 10px', fontSize: 12}}
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={onOk}
          disabled={!instruction.trim()}
          style={{padding: '4px 10px', fontSize: 12, background: 'var(--craft-accent)', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#000', fontWeight: 600}}
        >
          ОК
        </button>
      </div>
      <div style={{marginTop: 6, fontSize: 10, color: '#666'}}>Ctrl+Enter — сохранить</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers

export function viewModeToImageType(mode: CharacterViewMode): CharacterImageType {
  if (mode === 'fullBody') return 'full_body';
  if (mode === 'scene') return 'scene';
  return 'portrait';
}

const REGION_BY_IMAGE_TYPE: Record<CharacterImageType, string> = {
  portrait: 'face',
  full_body: 'body',
  scene: 'style',
};

function withCacheBust(url: string, key?: string | null) {
  if (!key) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_cb=${encodeURIComponent(key)}`;
}

// Asset types that legitimately represent the portrait view of a character.
// We only fall back to character.references[] when the canonical
// `images.portrait` slot is empty AND the asset is actually a portrait-class
// reference of THIS character — never an unrelated uploaded photo or outfit
// reference, which previously produced "another character's face" in the
// editor when `images.portrait` was briefly missing.
const PORTRAIT_REFERENCE_ASSET_TYPES = new Set(['portrait', 'uploaded_reference']);

function getPreviewImage(
  character?: StudioCharacter | null,
  selectedVariant?: CharacterVariant | null,
  imageType: CharacterImageType = 'portrait',
) {
  if (selectedVariant?.image_url && selectedVariant.region === REGION_BY_IMAGE_TYPE[imageType]) {
    return selectedVariant.image_url;
  }
  const modeAsset = character?.images?.[imageType];
  const modeImage = modeAsset?.image_url;
  if (modeImage) return withCacheBust(modeImage, modeAsset?.asset_id ?? null);
  if (imageType !== 'portrait') return null;
  const references = (character?.references || []).filter(
    (reference) => PORTRAIT_REFERENCE_ASSET_TYPES.has(reference.asset_type),
  );
  return (
    references.find((reference) => reference.is_primary)?.image_url ||
    references.find((reference) => reference.is_canonical)?.image_url ||
    references[0]?.image_url ||
    null
  );
}

const generatingCopyByMode: Record<CharacterViewMode, {title: string; text: string}> = {
  portrait: {title: 'Генерируем портрет…', text: 'Создаём изображение лица и плеч персонажа.'},
  fullBody: {title: 'Генерируем полный рост…', text: 'Создаём изображение персонажа в полный рост.'},
  scene: {title: 'Генерируем сцену…', text: 'Создаём персонажа в сцене с фоном и окружением.'},
};

type TabStatus = 'ready' | 'generating' | 'failed' | 'idle';

function getTabStatus(
  imageType: CharacterImageType,
  character?: StudioCharacter | null,
  secondaryJobs?: AssetJobsMap,
  generatingImageType?: CharacterImageType | null,
): TabStatus {
  if (generatingImageType === imageType) return 'generating';
  const job = secondaryJobs?.[imageType];
  if (job) {
    if (job.status === 'queued' || job.status === 'processing') return 'generating';
    if (job.status === 'failed') return 'failed';
    if (job.status === 'completed') return 'ready';
  }
  if (character?.images?.[imageType]?.image_url) return 'ready';
  return 'idle';
}

function TabStatusDot({status}: {status: TabStatus}) {
  if (status === 'idle') return null;
  return (
    <span
      className={`character-preview-tabs__status character-preview-tabs__status--${status}`}
      aria-hidden="true"
    />
  );
}

function FailedState({
  viewMode,
  errorMessage,
  onRetry,
}: {
  viewMode: CharacterViewMode;
  errorMessage?: string;
  onRetry: () => void;
}) {
  const copy = generatingCopyByMode[viewMode];
  return (
    <div className="character-preview-failed">
      <div className="character-preview-failed__icon">!</div>
      <h3>Ошибка генерации</h3>
      <p>
        {errorMessage ||
          `Не удалось сгенерировать «${copy.title.replace('Генерируем ', '').replace('…', '')}». Попробуйте ещё раз.`}
      </p>
      <button type="button" onClick={onRetry} className="character-preview-failed__retry">
        Повторить генерацию
      </button>
    </div>
  );
}

function GeneratingState({viewMode, progress}: {viewMode: CharacterViewMode; progress?: number}) {
  const copy = generatingCopyByMode[viewMode];
  const hasProgress = typeof progress === 'number' && progress > 0;
  return (
    <div className="character-preview-generating">
      <div className="character-preview-generating__spinner" />
      <h3>{copy.title}</h3>
      <p>{copy.text}</p>
      {hasProgress ? (
        <div className="character-preview-generating__progress">
          <div className="character-preview-generating__progress-bar" style={{width: `${progress}%`}} />
          <span className="character-preview-generating__progress-label">{progress}%</span>
        </div>
      ) : (
        <div className="character-preview-generating__progress">
          <div className="character-preview-generating__progress-bar character-preview-generating__progress-bar--indeterminate" />
        </div>
      )}
      <button type="button" className="character-preview-generating__btn" disabled>
        Генерируется…
      </button>
    </div>
  );
}

const emptyCopyByMode: Record<CharacterViewMode, {title: string; text: string}> = {
  portrait: {title: 'Портрет пока не создан', text: 'Сгенерируйте первый вариант портрета'},
  fullBody: {title: 'Модель полного роста пока не создана', text: 'Сгенерируйте полный рост на основе портрета'},
  scene: {title: 'Сцена пока не создана', text: 'Выберите фон, свет и камеру для первого кадра'},
};

function SceneBackdrop() {
  return (
    <div className="scene-backdrop" aria-hidden="true">
      <span className="scene-backdrop__sun" />
      <span className="scene-backdrop__floor" />
    </div>
  );
}
