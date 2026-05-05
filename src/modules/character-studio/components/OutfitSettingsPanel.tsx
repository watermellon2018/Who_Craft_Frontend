import React, {useRef, useState} from 'react';
import {Input, message} from 'antd';
import {CloseOutlined, PlusOutlined, WarningOutlined} from '@ant-design/icons';
import {characterApi} from '../api/characterApi';
import {ClothingReference} from '../types/character.types';

const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_ATTR = '.jpg,.jpeg,.png,.webp';

interface OutfitSettingsPanelProps {
  projectId: string;
  characterId: string;
  clothingReferences: ClothingReference[];
  onReferencesChange: (refs: ClothingReference[]) => void;
  outfitDescription: string;
  onDescriptionChange: (value: string) => void;
  outfitSource: 'reference' | 'text';
  onSourceChange: (value: 'reference' | 'text') => void;
}

export default function OutfitSettingsPanel({
  projectId,
  characterId,
  clothingReferences,
  onReferencesChange,
  outfitDescription,
  onDescriptionChange,
  outfitSource,
  onSourceChange,
}: OutfitSettingsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File) => {
    if (!ACCEPTED_MIME.includes(file.type)) {
      message.error('Поддерживаются только JPG, PNG и WebP.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      message.error('Файл не должен превышать 10 МБ.');
      return;
    }
    setUploading(true);
    try {
      const response = await characterApi.uploadClothingReference(projectId, characterId, file);
      const asset = response.data as ClothingReference;
      onReferencesChange([...clothingReferences, asset]);
      message.success('Референс загружен');
    } catch {
      message.error('Ошибка загрузки. Попробуйте ещё раз.');
    } finally {
      setUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleRemoveReference = async (assetId: string) => {
    try {
      await characterApi.deleteClothingReference(projectId, characterId, assetId);
      onReferencesChange(clothingReferences.filter((r) => r.asset_id !== assetId));
      message.success('Референс удалён');
    } catch {
      message.error('Ошибка при удалении.');
    }
  };

  const showReferenceWarning = outfitSource === 'reference' && clothingReferences.length === 0;

  return (
    <div className="character-settings-panel">
      <div className="character-settings-panel__header">
        <p>Контекстная панель</p>
        <h2>Настройки: Одежда</h2>
      </div>
      <div className="character-settings-panel__body">

        {/* Блок: Источник */}
        <section className="character-settings-section character-settings-section--primary">
          <h3>Источник</h3>
          <div className="character-segmented">
            {(['reference', 'text'] as const).map((src) => (
              <button
                key={src}
                type="button"
                className={outfitSource === src ? 'is-active' : ''}
                onClick={() => onSourceChange(src)}
              >
                {src === 'reference' ? 'Референс' : 'Текст'}
              </button>
            ))}
          </div>
          <p className="outfit-source-hint">
            Одежда применяется при обновлении портрета, полного роста и ракурсов.
          </p>
        </section>

        {/* Блок: Референсы одежды */}
        <section className="character-settings-section">
          <h3>Референсы одежды</h3>
          <p className="character-section-description">
            Загрузите примеры одежды, которую должен носить персонаж.
          </p>

          {clothingReferences.length > 0 && (
            <div className="outfit-reference-preview">
              {clothingReferences.map((ref) => (
                <div key={ref.asset_id} className="outfit-reference-preview__item">
                  <img src={ref.image_url} alt="Референс одежды" />
                  <button
                    type="button"
                    className="outfit-reference-preview__remove"
                    onClick={() => handleRemoveReference(ref.asset_id)}
                    aria-label="Удалить референс"
                  >
                    <CloseOutlined />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            className={`outfit-upload-area${dragging ? ' outfit-upload-area--dragging' : ''}${uploading ? ' outfit-upload-area--loading' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && !uploading && fileInputRef.current?.click()}
            aria-label="Загрузить референс одежды"
          >
            <PlusOutlined className="outfit-upload-area__icon" />
            <span className="outfit-upload-area__primary">
              {uploading ? 'Загружаем...' : 'Перетащите изображение сюда'}
            </span>
            <span className="outfit-upload-area__secondary">
              {uploading ? '' : 'или нажмите для загрузки'}
            </span>
            {!uploading && (
              <button
                type="button"
                className="outfit-upload-area__button"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              >
                Загрузить
              </button>
            )}
          </div>

          {showReferenceWarning && (
            <p className="outfit-reference-warning">
              <WarningOutlined /> Добавьте референс одежды или переключитесь на «Текст»
            </p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_ATTR}
            style={{display: 'none'}}
            onChange={handleInputChange}
          />
        </section>

        {/* Блок: Сгенерировать по описанию */}
        <section className="character-settings-section">
          <h3>Сгенерировать по описанию</h3>
          <Input.TextArea
            value={outfitDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Например: чёрная кожаная куртка в стиле киберпанк с неоновыми вставками"
            rows={4}
            maxLength={500}
            showCount
          />
        </section>

      </div>
    </div>
  );
}
