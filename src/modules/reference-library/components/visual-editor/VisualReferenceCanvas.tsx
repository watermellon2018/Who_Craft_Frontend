import {
  FullscreenOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import {Alert, Button, Checkbox, Input, Tooltip} from 'antd';
import React, {useRef} from 'react';
import {useTranslation} from 'react-i18next';

import type {LocalVisualVariant} from './types';

const TOOLTIP_ROOT_CLASS_NAME = 'visual-reference-tooltip';

interface VisualReferenceCanvasProps {
  accept: string;
  activeVariantId: string | null;
  canGenerate: boolean;
  disabled: boolean;
  generating: boolean;
  primaryVariantId: string | null;
  prompt: string;
  rightsConfirmed: boolean;
  variants: LocalVisualVariant[];
  zoom: number;
  onFileSelect: (file: File, replaceVariantId?: string) => void;
  onGenerate: () => void;
  onPrimaryChange: (variantId: string) => void;
  onPromptChange: (prompt: string) => void;
  onRightsChange: (checked: boolean) => void;
  onVariantSelect: (variantId: string) => void;
  onZoomChange: (zoom: number) => void;
}

export default function VisualReferenceCanvas({
  accept,
  activeVariantId,
  canGenerate,
  disabled,
  generating,
  primaryVariantId,
  prompt,
  rightsConfirmed,
  variants,
  zoom,
  onFileSelect,
  onGenerate,
  onPrimaryChange,
  onPromptChange,
  onRightsChange,
  onVariantSelect,
  onZoomChange,
}: VisualReferenceCanvasProps) {
  const {t} = useTranslation();
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceVariantIdRef = useRef<string>();
  const activeVariant = variants.find(({id}) => id === activeVariantId) ?? variants[0];
  const generationDisabled = disabled || !canGenerate || !prompt.trim();

  const chooseFile = (replaceVariantId?: string) => {
    replaceVariantIdRef.current = replaceVariantId;
    fileInputRef.current?.click();
  };
  const enterFullscreen = () => {
    const fullscreenRequest = canvasRef.current?.requestFullscreen?.();
    void fullscreenRequest?.catch(() => undefined);
  };

  return (
    <section className="visual-reference-stage" aria-label={t('referenceLibrary.editor.canvas.label')}>
      <input
        ref={fileInputRef}
        className="visual-reference-file-input"
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelect(file, replaceVariantIdRef.current);
          replaceVariantIdRef.current = undefined;
          event.target.value = '';
        }}
      />

      <div ref={canvasRef} className="visual-reference-canvas">
        {activeVariant ? (
          <>
            <div className="visual-reference-canvas__toolbar">
              <Tooltip
                rootClassName={TOOLTIP_ROOT_CLASS_NAME}
                title={t('referenceLibrary.editor.canvas.zoomOut')}
              >
                <Button
                  aria-label={t('referenceLibrary.editor.canvas.zoomOut')}
                  icon={<ZoomOutOutlined />}
                  disabled={zoom <= 0.7}
                  onClick={() => onZoomChange(Math.max(0.7, zoom - 0.1))}
                />
              </Tooltip>
              <Tooltip
                rootClassName={TOOLTIP_ROOT_CLASS_NAME}
                title={t('referenceLibrary.editor.canvas.zoomIn')}
              >
                <Button
                  aria-label={t('referenceLibrary.editor.canvas.zoomIn')}
                  icon={<ZoomInOutlined />}
                  disabled={zoom >= 1.6}
                  onClick={() => onZoomChange(Math.min(1.6, zoom + 0.1))}
                />
              </Tooltip>
              <Tooltip
                rootClassName={TOOLTIP_ROOT_CLASS_NAME}
                title={t('referenceLibrary.editor.canvas.fullscreen')}
              >
                <Button
                  aria-label={t('referenceLibrary.editor.canvas.fullscreen')}
                  icon={<FullscreenOutlined />}
                  onClick={enterFullscreen}
                />
              </Tooltip>
            </div>
            <div className="visual-reference-canvas__image-wrap">
              <img
                src={activeVariant.previewUrl}
                alt={activeVariant.name}
                style={{transform: `scale(${zoom})`}}
              />
            </div>
            <div className="visual-reference-canvas__image-actions">
              <Button
                icon={<UploadOutlined />}
                disabled={disabled}
                onClick={() => chooseFile(activeVariant.id)}
              >
                {t('referenceLibrary.editor.canvas.replace')}
              </Button>
              {primaryVariantId !== activeVariant.id && (
                <Button
                  type="primary"
                  disabled={disabled}
                  onClick={() => onPrimaryChange(activeVariant.id)}
                >
                  {t('referenceLibrary.editor.canvas.setPrimary')}
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="visual-reference-empty">
            <span className="visual-reference-empty__icon"><PictureOutlined /></span>
            <h2>{t('referenceLibrary.editor.empty.title')}</h2>
            <p>{t('referenceLibrary.editor.empty.description')}</p>
            <div className="visual-reference-empty__actions">
              <Tooltip
                rootClassName={TOOLTIP_ROOT_CLASS_NAME}
                title={generationDisabled
                  ? t('referenceLibrary.editor.generate.promptRequired')
                  : undefined}
              >
                <span>
                  <Button
                    type="primary"
                    disabled={generationDisabled}
                    loading={generating}
                    onClick={onGenerate}
                  >
                    {t('referenceLibrary.editor.empty.generate')}
                  </Button>
                </span>
              </Tooltip>
              <Button
                icon={<UploadOutlined />}
                disabled={disabled}
                onClick={() => chooseFile()}
              >
                {t('referenceLibrary.editor.empty.upload')}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="visual-reference-prompt-editor">
        <label htmlFor="visual-reference-generation-prompt">
          {t('referenceLibrary.editor.fields.prompt')}
        </label>
        <Input.TextArea
          id="visual-reference-generation-prompt"
          disabled={disabled}
          maxLength={4000}
          placeholder={t('referenceLibrary.editor.placeholders.prompt')}
          rows={4}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
        />
        <div className="visual-reference-prompt-editor__footer">
          {!canGenerate && (
            <Alert
              type="info"
              showIcon
              message={t('referenceLibrary.editor.generate.unavailable')}
            />
          )}
          <Tooltip
            rootClassName={TOOLTIP_ROOT_CLASS_NAME}
            title={!prompt.trim()
              ? t('referenceLibrary.editor.generate.promptRequired')
              : undefined}
          >
            <span>
              <Button
                className="visual-reference-generate-button"
                icon={activeVariant ? <ReloadOutlined /> : undefined}
                disabled={generationDisabled}
                loading={generating}
                onClick={onGenerate}
              >
                {t(activeVariant
                  ? 'referenceLibrary.editor.generate.again'
                  : 'referenceLibrary.editor.generate.action')}
              </Button>
            </span>
          </Tooltip>
        </div>
      </div>

      <div className="visual-reference-variants-heading">
        <h2>{t('referenceLibrary.editor.variants.title')}</h2>
        <span>{variants.length}</span>
      </div>
      <div
        className="visual-reference-variants"
        aria-label={t('referenceLibrary.editor.variants.title')}
      >
        {variants.map((variant, index) => {
          const selected = variant.id === activeVariant?.id;
          const primary = variant.id === primaryVariantId;
          return (
            <button
              key={variant.id}
              type="button"
              className={`visual-reference-variant${selected ? ' is-selected' : ''}`}
              aria-label={t('referenceLibrary.editor.variants.item', {
                name: variant.name,
                number: index + 1,
              })}
              aria-pressed={selected}
              onClick={() => onVariantSelect(variant.id)}
            >
              <img src={variant.previewUrl} alt="" />
              {primary && <span>{t('referenceLibrary.editor.variants.primary')}</span>}
            </button>
          );
        })}
        <button
          type="button"
          className="visual-reference-variant visual-reference-variant--create"
          disabled={disabled}
          onClick={() => chooseFile()}
        >
          <PlusOutlined />
          <span>{t('referenceLibrary.editor.variants.create')}</span>
        </button>
      </div>

      {variants.length > 0 && (
        <Checkbox
          className="visual-reference-rights"
          checked={rightsConfirmed}
          disabled={disabled}
          onChange={(event) => onRightsChange(event.target.checked)}
        >
          {t('referenceLibrary.upload.rights')}
        </Checkbox>
      )}
    </section>
  );
}
