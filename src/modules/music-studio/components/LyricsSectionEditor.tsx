import React from 'react';
import {Button, Input, Select, Space} from 'antd';
import {DeleteOutlined, DownOutlined, PlusOutlined, UpOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';

import type {MusicLyricsSection, MusicLyricsSectionType} from '../types';

interface LyricsSectionEditorProps {
  languages: string[];
  maxChars: number;
  onLanguageChange: (language: string) => void;
  onSectionsChange: (sections: MusicLyricsSection[]) => void;
  sectionTypes: MusicLyricsSectionType[];
  sections: MusicLyricsSection[];
  selectedLanguage: string;
}

function nextLabel(type: MusicLyricsSectionType, sections: MusicLyricsSection[], label: string) {
  const count = sections.filter((section) => section.type === type).length + 1;
  return `${label}${type === 'verse' ? ` ${count}` : ''}`;
}

export default function LyricsSectionEditor({
  languages,
  maxChars,
  onLanguageChange,
  onSectionsChange,
  sectionTypes,
  sections,
  selectedLanguage,
}: LyricsSectionEditorProps) {
  const {t} = useTranslation();
  const characters = sections.reduce((total, section) => total + section.text.length, 0);

  const updateSection = (index: number, patch: Partial<MusicLyricsSection>) => {
    onSectionsChange(sections.map((section, currentIndex) => (
      currentIndex === index ? {...section, ...patch} : section
    )));
  };

  const addSection = (type: MusicLyricsSectionType) => {
    const label = t(`musicStudio.lyrics.types.${type}`);
    onSectionsChange([
      ...sections,
      {label: nextLabel(type, sections, label), text: '', type},
    ]);
  };

  const move = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    onSectionsChange(next);
  };

  return (
    <section className="music-card music-lyrics" aria-labelledby="music-lyrics-title">
      <div className="music-section-heading">
        <div>
          <h2 id="music-lyrics-title">{t('musicStudio.lyrics.title')}</h2>
          <p>{t('musicStudio.lyrics.helper')}</p>
        </div>
        <span className={characters > maxChars ? 'music-counter music-counter--error' : 'music-counter'}>
          {characters}/{maxChars}
        </span>
      </div>

      <label className="music-field-label" htmlFor="music-lyrics-language">
        {t('musicStudio.lyrics.language')}
      </label>
      <Select
        id="music-lyrics-language"
        aria-label={t('musicStudio.lyrics.language')}
        value={selectedLanguage}
        onChange={onLanguageChange}
        options={languages.map((language) => ({
          label: t(`musicStudio.options.language.${language}`, {defaultValue: language.toUpperCase()}),
          value: language,
        }))}
      />

      <div className="music-lyrics__sections">
        {sections.map((section, index) => (
          <article className="music-lyrics__section" key={`${index}-${section.type}`}>
            <div className="music-lyrics__section-toolbar">
              <Select
                aria-label={t('musicStudio.lyrics.sectionType')}
                value={section.type}
                onChange={(type: MusicLyricsSectionType) => updateSection(index, {
                  label: t(`musicStudio.lyrics.types.${type}`),
                  type,
                })}
                options={sectionTypes.map((type) => ({
                  label: t(`musicStudio.lyrics.types.${type}`),
                  value: type,
                }))}
              />
              <Input
                aria-label={t('musicStudio.lyrics.sectionLabel')}
                value={section.label}
                onChange={(event) => updateSection(index, {label: event.target.value})}
              />
              <Space size={4}>
                <Button
                  aria-label={t('musicStudio.lyrics.moveUp')}
                  disabled={index === 0}
                  icon={<UpOutlined />}
                  onClick={() => move(index, -1)}
                />
                <Button
                  aria-label={t('musicStudio.lyrics.moveDown')}
                  disabled={index === sections.length - 1}
                  icon={<DownOutlined />}
                  onClick={() => move(index, 1)}
                />
                <Button
                  aria-label={t('musicStudio.lyrics.removeSection')}
                  danger
                  disabled={sections.length === 1}
                  icon={<DeleteOutlined />}
                  onClick={() => onSectionsChange(sections.filter((_, itemIndex) => itemIndex !== index))}
                />
              </Space>
            </div>
            <Input.TextArea
              aria-label={`${section.label} — ${t('musicStudio.lyrics.text')}`}
              autoSize={{minRows: 3, maxRows: 12}}
              maxLength={maxChars}
              placeholder={t('musicStudio.lyrics.placeholder')}
              value={section.text}
              onChange={(event) => updateSection(index, {text: event.target.value})}
            />
          </article>
        ))}
      </div>

      <Space wrap>
        {sectionTypes.map((type) => (
          <Button key={type} icon={<PlusOutlined />} onClick={() => addSection(type)}>
            {t(`musicStudio.lyrics.add.${type}`)}
          </Button>
        ))}
      </Space>
    </section>
  );
}
