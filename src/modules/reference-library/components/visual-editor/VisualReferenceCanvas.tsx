import {
  FullscreenOutlined,
  PictureOutlined,
  ReloadOutlined,
  SaveOutlined,
  UploadOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import {Alert, Button, Input, Tooltip} from 'antd';
import React, {useRef} from 'react';
import {useTranslation} from 'react-i18next';

import type {VisualCanvasImage} from './types';

const TOOLTIP_ROOT_CLASS_NAME = 'visual-reference-tooltip';

interface VisualReferenceCanvasProps {
  accept: string;
  activeImage: VisualCanvasImage | null;
  addingToDrafts: boolean;
  canGenerate: boolean;
  canAddActiveToDrafts: boolean;
  disabled: boolean;
  generating: boolean;
  primaryImageId: string | null;
  prompt: string;
  zoom: number;
  onAddToDrafts: () => void;
  onGenerate: () => void;
  onPrimaryChange: (imageId: string) => void;
  onPromptChange: (prompt: string) => void;
  onUpload: (file: File) => void;
  onZoomChange: (zoom: number) => void;
}

export default function VisualReferenceCanvas({
  accept,
  activeImage,
  addingToDrafts,
  canGenerate,
  canAddActiveToDrafts,
  disabled,
  generating,
  primaryImageId,
  prompt,
  zoom,
  onAddToDrafts,
  onGenerate,
  onPrimaryChange,
  onPromptChange,
  onUpload,
  onZoomChange,
}: VisualReferenceCanvasProps) {
  const {t} = useTranslation();
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generationDisabled = disabled || !canGenerate || !prompt.trim();
  const isUnsavedPreview = Boolean(activeImage && canAddActiveToDrafts);

  const openUploadPicker = () => fileInputRef.current?.click();
  const enterFullscreen = () => {
    const fullscreenRequest = canvasRef.current?.requestFullscreen?.();
    void fullscreenRequest?.catch(() => undefined);
  };

  return (
    <section className="visual-reference-stage" aria-label={t('referenceLibrary.editor.canvas.label')}>
      <input
        ref={fileInputRef}
        aria-label={t('referenceLibrary.editor.empty.upload')}
        className="visual-reference-file-input"
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file);
          event.target.value = '';
        }}
      />

      <div ref={canvasRef} className="visual-reference-canvas">
        {activeImage ? (
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
            {isUnsavedPreview && (
              <span className="visual-reference-canvas__unsaved">
                {t('referenceLibrary.editor.drafts.unsaved')}
              </span>
            )}
            <div className="visual-reference-canvas__image-wrap">
              <img
                src={activeImage.imageUrl}
                alt={activeImage.name}
                style={{transform: `scale(${zoom})`}}
              />
            </div>
            <div className="visual-reference-canvas__image-actions">
              <Button
                icon={<UploadOutlined />}
                aria-label={t(activeImage.source === 'uploaded'
                  ? 'referenceLibrary.editor.canvas.replace'
                  : 'referenceLibrary.editor.empty.upload')}
                disabled={disabled}
                onClick={openUploadPicker}
              >
                {t(activeImage.source === 'uploaded'
                  ? 'referenceLibrary.editor.canvas.replace'
                  : 'referenceLibrary.editor.empty.upload')}
              </Button>
              {isUnsavedPreview ? (
                <Button
                  key="add-to-drafts"
                  type="primary"
                  className="visual-reference-add-draft"
                  icon={<SaveOutlined />}
                  aria-label={t('referenceLibrary.editor.drafts.add')}
                  disabled={disabled || addingToDrafts}
                  loading={addingToDrafts}
                  onClick={onAddToDrafts}
                >
                  {t('referenceLibrary.editor.drafts.add')}
                </Button>
              ) : primaryImageId !== activeImage.id && (
                <Button
                  key="set-primary"
                  type="primary"
                  aria-label={t('referenceLibrary.editor.canvas.setPrimary')}
                  disabled={disabled}
                  onClick={() => onPrimaryChange(activeImage.id)}
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
                aria-label={t('referenceLibrary.editor.empty.upload')}
                disabled={disabled}
                onClick={openUploadPicker}
              >
                {t('referenceLibrary.editor.empty.upload')}
              </Button>
            </div>
          </div>
        )}
        {generating && (
          <span className="visual-reference-canvas__generation-status" role="status">
            <ReloadOutlined spin />
            {t('referenceLibrary.editor.generate.loading')}
          </span>
        )}
      </div>

      <fieldset className="visual-reference-prompt-editor">
        <legend className="visual-reference-prompt-editor__legend">
          <label
            className="visual-reference-prompt-editor__label"
            htmlFor="visual-reference-generation-prompt"
          >
            {t('referenceLibrary.editor.fields.prompt')}
          </label>
        </legend>
        <Input.TextArea
          autoSize={{minRows: 2, maxRows: 4}}
          className="visual-reference-prompt-editor__input"
          id="visual-reference-generation-prompt"
          disabled={disabled}
          maxLength={4000}
          placeholder={t('referenceLibrary.editor.placeholders.prompt')}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
        />
        <Tooltip
          rootClassName={TOOLTIP_ROOT_CLASS_NAME}
          title={!prompt.trim()
            ? t('referenceLibrary.editor.generate.promptRequired')
            : undefined}
        >
          <span className="visual-reference-prompt-editor__action-wrap">
            <Button
              type="primary"
              className="visual-reference-generate-button"
              icon={activeImage ? <ReloadOutlined /> : undefined}
              aria-label={t(activeImage
                ? 'referenceLibrary.editor.generate.again'
                : 'referenceLibrary.editor.generate.action')}
              disabled={generationDisabled}
              loading={generating}
              onClick={onGenerate}
            >
              {t(activeImage
                ? 'referenceLibrary.editor.generate.again'
                : 'referenceLibrary.editor.generate.action')}
            </Button>
          </span>
        </Tooltip>
        {!canGenerate && (
          <Alert
            className="visual-reference-prompt-editor__notice"
            type="info"
            showIcon
            message={t('referenceLibrary.editor.generate.unavailable')}
          />
        )}
      </fieldset>

    </section>
  );
}
