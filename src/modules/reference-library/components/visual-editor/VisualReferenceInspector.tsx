import {
  CloseOutlined,
  EnvironmentOutlined,
  PlusOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {Button, ColorPicker, Form, Input, message, Segmented, Select, Tooltip} from 'antd';
import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';

import type {ReferenceBrief} from '../../types';
import VisualReferenceDrafts from './VisualReferenceDrafts';
import VisualInspectorShell from './VisualInspectorShell';
import {
  CONTINUITY_LABEL_KEYS,
  VISUAL_REFERENCE_TYPE_ORDER,
} from './types';
import type {
  VisualInspectorTab,
  VisualReferenceDraft,
  VisualReferenceType,
  VisualRelation,
  VisualRelationCandidate,
  VisualRelationKind,
} from './types';

const RELATION_KINDS: VisualRelationKind[] = ['character', 'location'];
const SELECT_POPUP_CLASS_NAME = 'visual-reference-select-popup';

export interface MainSettingsTabProps {
  category: VisualReferenceType;
  description: string;
  disabled: boolean;
  onCategoryChange: (category: VisualReferenceType) => void;
  onDescriptionChange: (description: string) => void;
}

export function MainSettingsTab({
  category,
  description,
  disabled,
  onCategoryChange,
  onDescriptionChange,
}: MainSettingsTabProps) {
  const {t} = useTranslation();

  return (
    <Form layout="vertical" className="visual-reference-inspector__form">
      <Form.Item label={t('referenceLibrary.editor.fields.type')} required>
        <Select
          aria-label={t('referenceLibrary.editor.fields.type')}
          disabled={disabled}
          popupClassName={SELECT_POPUP_CLASS_NAME}
          value={category}
          options={VISUAL_REFERENCE_TYPE_ORDER.map((value) => ({
            label: t(`referenceLibrary.category.${value}`),
            value,
          }))}
          onChange={onCategoryChange}
        />
      </Form.Item>
      <Form.Item label={t('referenceLibrary.editor.fields.description')}>
        <Input.TextArea
          aria-label={t('referenceLibrary.editor.fields.description')}
          disabled={disabled}
          maxLength={4000}
          placeholder={t('referenceLibrary.editor.placeholders.description')}
          rows={4}
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
        />
      </Form.Item>
    </Form>
  );
}

export interface AppearanceSettingsTabProps {
  brief: ReferenceBrief;
  category: VisualReferenceType;
  disabled: boolean;
  onBriefChange: (brief: ReferenceBrief) => void;
}

export function AppearanceSettingsTab({
  brief,
  category,
  disabled,
  onBriefChange,
}: AppearanceSettingsTabProps) {
  const {t} = useTranslation();
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const palette = brief.palette ?? [];
  const patchBrief = (patch: Partial<ReferenceBrief>) => onBriefChange({...brief, ...patch});
  const addColor = (color: string) => {
    if (!palette.includes(color)) {
      patchBrief({palette: [...palette, color].slice(0, 12)});
    }
    setColorPickerOpen(false);
  };

  return (
    <Form layout="vertical" className="visual-reference-inspector__form">
      <Form.Item label={t('referenceLibrary.editor.fields.palette')}>
        <div className="visual-reference-palette">
          {palette.map((color) => (
            <span key={color} className="visual-reference-palette__item">
              <i style={{backgroundColor: color}} />
              <button
                type="button"
                disabled={disabled}
                aria-label={t('referenceLibrary.editor.palette.remove', {color})}
                onClick={() => patchBrief({palette: palette.filter((item) => item !== color)})}
              >
                <CloseOutlined />
              </button>
            </span>
          ))}
          <ColorPicker
            defaultValue="#d8a15d"
            disabled={disabled || palette.length >= 12}
            open={colorPickerOpen}
            rootClassName="visual-reference-color-popup"
            onChangeComplete={(color) => addColor(color.toHexString())}
            onOpenChange={setColorPickerOpen}
          >
            <Button
              className="visual-reference-palette__add"
              aria-label={t('referenceLibrary.editor.palette.add')}
              icon={<PlusOutlined />}
              disabled={disabled || palette.length >= 12}
            />
          </ColorPicker>
        </div>
      </Form.Item>
      <Form.Item label={t(CONTINUITY_LABEL_KEYS[category])}>
        <Input.TextArea
          aria-label={t(CONTINUITY_LABEL_KEYS[category])}
          disabled={disabled}
          maxLength={2000}
          rows={4}
          placeholder={t(`referenceLibrary.editor.placeholders.continuity.${category}`)}
          value={brief.continuityNotes ?? ''}
          onChange={(event) => patchBrief({continuityNotes: event.target.value})}
        />
      </Form.Item>
    </Form>
  );
}

interface RelationsSettingsTabProps {
  disabled: boolean;
  relationCandidates: VisualRelationCandidate[];
  relations: VisualRelation[];
  onRelationsChange: (relations: VisualRelation[]) => void;
}

const RELATION_ICONS: Record<VisualRelationKind, React.ReactNode> = {
  character: <TeamOutlined />,
  location: <EnvironmentOutlined />,
};

function RelationsSettingsTab({
  disabled,
  relationCandidates,
  relations,
  onRelationsChange,
}: RelationsSettingsTabProps) {
  const {t} = useTranslation();
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<VisualRelationKind>('character');
  const [candidateId, setCandidateId] = useState<string>();
  const hasLocationRelation = relations.some((relation) => relation.kind === 'location');
  const candidates = useMemo(() => (
    relationCandidates.filter((candidate) => (
      candidate.kind === kind && !relations.some(({id}) => id === candidate.id)
      && (kind !== 'location' || !hasLocationRelation)
    ))
  ), [hasLocationRelation, kind, relationCandidates, relations]);

  const selectedCandidate = candidates.find(({id}) => id === candidateId);
  const addRelation = async () => {
    const candidate = candidates.find(({id}) => id === candidateId);
    if (!candidate) return;
    setAdding(true);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      onRelationsChange([...relations, {
        id: candidate.id,
        kind: candidate.kind,
        name: candidate.name,
      }]);
      setCandidateId(undefined);
      message.success(t('referenceLibrary.editor.relations.added'));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="visual-reference-relations">
      <div className="visual-reference-relations__add">
        <Segmented
          block
          className="visual-reference-relations__kind"
          aria-label={t('referenceLibrary.editor.relations.kind')}
          disabled={disabled}
          value={kind}
          options={RELATION_KINDS.map((value) => ({
            label: t(`referenceLibrary.editor.relations.types.${value}`),
            value,
          }))}
          onChange={(value) => {
            if (value === 'character' || value === 'location') {
              setKind(value);
              setCandidateId(undefined);
            }
          }}
        />
        <Tooltip title={selectedCandidate?.name}>
          <Select
            className="visual-reference-relations__select"
            aria-label={t('referenceLibrary.editor.relations.item')}
            disabled={disabled}
            notFoundContent={t(`referenceLibrary.editor.relations.none.${kind}`)}
            popupClassName={SELECT_POPUP_CLASS_NAME}
            popupMatchSelectWidth
            value={candidateId}
            placeholder={t(`referenceLibrary.editor.relations.choose.${kind}`)}
            options={candidates.map(({id, name}) => ({label: name, value: id}))}
            optionRender={(option) => (
              <Tooltip title={String(option.label)}>
                <span className="visual-reference-relation-option">{option.label}</span>
              </Tooltip>
            )}
            onChange={setCandidateId}
          />
        </Tooltip>
        <Button
          aria-label={t('referenceLibrary.editor.relations.add')}
          icon={<PlusOutlined />}
          disabled={disabled || adding || !candidateId}
          loading={adding}
          onClick={() => void addRelation()}
        >
          {t('referenceLibrary.editor.relations.add')}
        </Button>
      </div>
      <div className="visual-reference-relations__list">
        {relations.length === 0 && (
          <div className="visual-reference-relations__empty">
            <strong>{t('referenceLibrary.editor.relations.empty')}</strong>
            <p>{t('referenceLibrary.editor.relations.emptyDescription')}</p>
          </div>
        )}
        {relations.map((relation) => (
          <article key={relation.id} className="visual-reference-relation">
            <span className="visual-reference-relation__icon">{RELATION_ICONS[relation.kind]}</span>
            <Tooltip title={relation.name}>
              <div>
                <small>{t(`referenceLibrary.editor.relations.types.${relation.kind}`)}</small>
                <strong>{relation.name}</strong>
              </div>
            </Tooltip>
            <Button
              type="text"
              icon={<CloseOutlined />}
              disabled={disabled}
              aria-label={t('referenceLibrary.editor.relations.remove', {name: relation.name})}
              onClick={() => onRelationsChange(relations.filter(({id}) => id !== relation.id))}
            />
          </article>
        ))}
      </div>
    </div>
  );
}

interface VisualReferenceInspectorProps extends MainSettingsTabProps {
  activeTab: VisualInspectorTab;
  activeImageId: string | null;
  brief: ReferenceBrief;
  drafts: VisualReferenceDraft[];
  primaryImageId: string | null;
  relationCandidates: VisualRelationCandidate[];
  relations: VisualRelation[];
  onBriefChange: (brief: ReferenceBrief) => void;
  onDeleteDraft: (draftId: string) => void;
  onPrimaryChange: (draftId: string) => void;
  onRelationsChange: (relations: VisualRelation[]) => void;
  onSelectDraft: (draftId: string) => void;
  onTabChange: (tab: VisualInspectorTab) => void;
}

function isInspectorTab(value: string): value is VisualInspectorTab {
  return value === 'main' || value === 'appearance' || value === 'relations';
}

export default function VisualReferenceInspector({
  activeTab,
  activeImageId,
  brief,
  category,
  description,
  disabled,
  drafts,
  primaryImageId,
  relationCandidates,
  relations,
  onBriefChange,
  onCategoryChange,
  onDescriptionChange,
  onDeleteDraft,
  onPrimaryChange,
  onRelationsChange,
  onSelectDraft,
  onTabChange,
}: VisualReferenceInspectorProps) {
  const {t} = useTranslation();

  return (
    <VisualInspectorShell
      activeTab={activeTab}
      onTabChange={(value) => {
        if (isInspectorTab(value)) onTabChange(value);
      }}
      items={[
          {
            key: 'main',
            label: t('referenceLibrary.editor.tabs.main'),
            children: (
              <MainSettingsTab
                category={category}
                description={description}
                disabled={disabled}
                onCategoryChange={onCategoryChange}
                onDescriptionChange={onDescriptionChange}
              />
            ),
          },
          {
            key: 'appearance',
            label: t('referenceLibrary.editor.tabs.appearance'),
            children: (
              <AppearanceSettingsTab
                brief={brief}
                category={category}
                disabled={disabled}
                onBriefChange={onBriefChange}
              />
            ),
          },
          {
            key: 'relations',
            label: t('referenceLibrary.editor.tabs.relations'),
            children: (
              <RelationsSettingsTab
                disabled={disabled}
                relationCandidates={relationCandidates}
                relations={relations}
                onRelationsChange={onRelationsChange}
              />
            ),
          },
      ]}
      bottomContent={<VisualReferenceDrafts
        activeImageId={activeImageId}
        disabled={disabled}
        drafts={drafts}
        primaryImageId={primaryImageId}
        onDeleteDraft={onDeleteDraft}
        onPrimaryChange={onPrimaryChange}
        onSelectDraft={onSelectDraft}
      />}
    />
  );
}
