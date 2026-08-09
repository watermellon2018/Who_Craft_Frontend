import {
  CloseOutlined,
  EnvironmentOutlined,
  LinkOutlined,
  PlusOutlined,
  TeamOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import {Alert, Button, ColorPicker, Form, Input, Select, Tabs} from 'antd';
import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';

import type {ReferenceBrief} from '../../types';
import {
  CONTINUITY_LABEL_KEYS,
  MOCK_RELATION_CANDIDATES,
  VISUAL_REFERENCE_TYPE_ORDER,
} from './types';
import type {
  VisualInspectorTab,
  VisualReferenceType,
  VisualRelation,
  VisualRelationKind,
} from './types';

const RELATION_KINDS: VisualRelationKind[] = ['character', 'scene', 'location', 'reference'];
const SELECT_POPUP_CLASS_NAME = 'visual-reference-select-popup';

interface MainSettingsTabProps {
  category: VisualReferenceType;
  description: string;
  disabled: boolean;
  onCategoryChange: (category: VisualReferenceType) => void;
  onDescriptionChange: (description: string) => void;
}

function MainSettingsTab({
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

interface AppearanceSettingsTabProps {
  brief: ReferenceBrief;
  category: VisualReferenceType;
  disabled: boolean;
  onBriefChange: (brief: ReferenceBrief) => void;
}

function AppearanceSettingsTab({
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
  relations: VisualRelation[];
  onRelationsChange: (relations: VisualRelation[]) => void;
}

const RELATION_ICONS: Record<VisualRelationKind, React.ReactNode> = {
  character: <TeamOutlined />,
  location: <EnvironmentOutlined />,
  reference: <LinkOutlined />,
  scene: <VideoCameraOutlined />,
};

function RelationsSettingsTab({
  disabled,
  relations,
  onRelationsChange,
}: RelationsSettingsTabProps) {
  const {t} = useTranslation();
  const [kind, setKind] = useState<VisualRelationKind>('character');
  const [candidateId, setCandidateId] = useState<string>();
  const candidates = useMemo(() => (
    MOCK_RELATION_CANDIDATES.filter((candidate) => (
      candidate.kind === kind && !relations.some(({id}) => id === candidate.id)
    ))
  ), [kind, relations]);

  const addRelation = () => {
    const candidate = candidates.find(({id}) => id === candidateId);
    if (!candidate) return;
    onRelationsChange([...relations, {
      id: candidate.id,
      kind: candidate.kind,
      name: t(candidate.nameKey),
    }]);
    setCandidateId(undefined);
  };

  return (
    <div className="visual-reference-relations">
      <Alert
        type="info"
        showIcon
        message={t('referenceLibrary.editor.relations.mockNotice')}
      />
      <div className="visual-reference-relations__add">
        <Select
          aria-label={t('referenceLibrary.editor.relations.kind')}
          disabled={disabled}
          popupClassName={SELECT_POPUP_CLASS_NAME}
          value={kind}
          options={RELATION_KINDS.map((value) => ({
            label: t(`referenceLibrary.editor.relations.kinds.${value}`),
            value,
          }))}
          onChange={(value) => {
            setKind(value);
            setCandidateId(undefined);
          }}
        />
        <Select
          aria-label={t('referenceLibrary.editor.relations.item')}
          disabled={disabled}
          popupClassName={SELECT_POPUP_CLASS_NAME}
          value={candidateId}
          placeholder={t('referenceLibrary.editor.relations.choose')}
          options={candidates.map(({id, nameKey}) => ({label: t(nameKey), value: id}))}
          onChange={setCandidateId}
        />
        <Button
          icon={<PlusOutlined />}
          disabled={disabled || !candidateId}
          onClick={addRelation}
        >
          {t('referenceLibrary.editor.relations.add')}
        </Button>
      </div>
      <div className="visual-reference-relations__list">
        {relations.length === 0 && (
          <p>{t('referenceLibrary.editor.relations.empty')}</p>
        )}
        {relations.map((relation) => (
          <article key={relation.id} className="visual-reference-relation">
            <span className="visual-reference-relation__icon">{RELATION_ICONS[relation.kind]}</span>
            <div>
              <strong>{relation.name}</strong>
              <small>{t(`referenceLibrary.editor.relations.kinds.${relation.kind}`)}</small>
            </div>
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
  brief: ReferenceBrief;
  relations: VisualRelation[];
  onBriefChange: (brief: ReferenceBrief) => void;
  onRelationsChange: (relations: VisualRelation[]) => void;
  onTabChange: (tab: VisualInspectorTab) => void;
}

function isInspectorTab(value: string): value is VisualInspectorTab {
  return value === 'main' || value === 'appearance' || value === 'relations';
}

export default function VisualReferenceInspector({
  activeTab,
  brief,
  category,
  description,
  disabled,
  relations,
  onBriefChange,
  onCategoryChange,
  onDescriptionChange,
  onRelationsChange,
  onTabChange,
}: VisualReferenceInspectorProps) {
  const {t} = useTranslation();

  return (
    <aside className="visual-reference-inspector">
      <Tabs
        activeKey={activeTab}
        onChange={(value) => {
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
                relations={relations}
                onRelationsChange={onRelationsChange}
              />
            ),
          },
        ]}
      />
    </aside>
  );
}
