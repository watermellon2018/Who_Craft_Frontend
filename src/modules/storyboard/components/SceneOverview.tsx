import {
  ApartmentOutlined,
  BulbOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import {Button, Form, Input, Select, Spin} from 'antd';
import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';

import type {StoryboardEntityType, StoryboardScene} from '../model';

export interface SceneEntity {
  available: boolean;
  id: string;
  kind: StoryboardEntityType;
  title: string;
}

export interface ManualShotValues {
  characterIds: string[];
  description: string;
  locationId?: string;
  referenceIds: string[];
  title: string;
}

interface SceneOverviewProps {
  aiGenerating: boolean;
  aiLoading: boolean;
  entities: SceneEntity[];
  scene: StoryboardScene;
  onAddMissingAsset: () => void;
  onCreateManual: (values: ManualShotValues) => void;
  onKeepScene: () => void;
  onSplitScene: () => void;
  onSuggest: () => void;
}

function ScreenplayExcerpt({scene, loading}: {scene: StoryboardScene; loading: boolean}) {
  const {t} = useTranslation();
  const blocks = scene.scriptBlocks?.filter(({text, type}) => (
    type !== 'scene_heading' && Boolean(text.trim())
  ));

  if (blocks?.length === 0 && !loading) return null;

  return (
    <div className={`storyboard-script${blocks ? '' : ' storyboard-script--plain'}`}>
      <div aria-busy={loading}>
        {blocks ? blocks.map((block) => (
          <p
            className={`storyboard-script__block storyboard-script__block--${block.type}`}
            key={block.id}
          >
            {block.text}
          </p>
        )) : scene.text}
      </div>
      <div
        aria-label={loading ? t('storyboard.ai.loading') : undefined}
        className={`storyboard-script__loading${loading ? ' storyboard-script__loading--active' : ''}`}
        role="status"
      >
        {loading && (
          <>
            <Spin aria-hidden="true" indicator={<LoadingOutlined spin />} size="large" />
            <span className="storyboard-script__loading-label">{t('storyboard.ai.loading')}</span>
          </>
        )}
      </div>
    </div>
  );
}

export default function SceneOverview({
  aiGenerating,
  aiLoading,
  entities,
  scene,
  onAddMissingAsset,
  onCreateManual,
  onKeepScene,
  onSplitScene,
  onSuggest,
}: SceneOverviewProps) {
  const {t} = useTranslation();
  const [manualOpen, setManualOpen] = useState(false);
  const [form] = Form.useForm<ManualShotValues>();
  const characters = entities.filter((entity) => entity.kind === 'character');
  const locations = entities.filter((entity) => entity.kind === 'location');
  const references = entities.filter((entity) => (
    entity.kind !== 'character' && entity.kind !== 'location'
  ));

  const handleFinish = (values: ManualShotValues) => {
    onCreateManual(values);
    form.resetFields();
    setManualOpen(false);
  };

  return (
    <section className="storyboard-overview" aria-labelledby="storyboard-scene-title">
      <p className="storyboard-overview__eyebrow">
        {t('storyboard.scene')} {scene.id.replace(/\D/g, '').padStart(2, '0')}
      </p>
      <h2 id="storyboard-scene-title">{scene.heading || scene.title}</h2>
      <ScreenplayExcerpt loading={aiGenerating} scene={scene} />

      <div className="storyboard-detected" aria-label={t('storyboard.detected')}>
        <span className="storyboard-detected__label">{t('storyboard.detected')}</span>
        {entities.map((entity) => (
          <span
            className={`storyboard-chip${entity.available ? '' : ' storyboard-chip--missing'}`}
            key={entity.id}
            title={entity.available ? entity.title : t('storyboard.visualAssetMissing')}
          >
            {entity.kind === 'character' && '● '}
            {entity.kind === 'location' && '⌖ '}
            {entity.kind !== 'character' && entity.kind !== 'location' && '◇ '}
            {entity.title}
            {!entity.available && <span>· {t('storyboard.assetMissing')}</span>}
          </span>
        ))}
        {entities.some((entity) => !entity.available) && (
          <Button onClick={onAddMissingAsset} size="small" type="link">
            {t('storyboard.addFromLibrary')}
          </Button>
        )}
      </div>

      {locations.length > 1 && (
        <div className="storyboard-notice" role="status">
          <div>
            <strong>{t('storyboard.locationSwitch.title')}</strong>
            <div>{t('storyboard.locationSwitch.description')}</div>
          </div>
          <div className="storyboard-inline-actions">
            <Button icon={<ApartmentOutlined aria-hidden="true" />} onClick={onSplitScene} size="small">
              {t('storyboard.locationSwitch.split')}
            </Button>
            <Button onClick={onKeepScene} size="small" type="text">
              {t('storyboard.locationSwitch.keep')}
            </Button>
          </div>
        </div>
      )}

      <div className="storyboard-overview__actions">
        <Button
          className="craft-action-button"
          disabled={aiLoading}
          onClick={onSuggest}
          type="primary"
        >
          {aiGenerating ? t('storyboard.ai.loading') : t('storyboard.ai.suggest')}
        </Button>
        <Button
          onClick={() => setManualOpen((open) => !open)}
          className="craft-action-button craft-action-button--secondary"
        >
          {t('storyboard.manual.create')}
        </Button>
      </div>

      {manualOpen && (
        <Form
          className="storyboard-control-group"
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          style={{marginTop: 20, maxWidth: 760}}
        >
          <div className="storyboard-section-heading">
            <div>
              <h3>{t('storyboard.manual.title')}</h3>
              <p>{t('storyboard.manual.help')}</p>
            </div>
            <BulbOutlined aria-hidden="true" />
          </div>
          <Form.Item
            label={t('storyboard.fields.title')}
            name="title"
            rules={[{required: true, message: t('storyboard.validation.shotTitle')}]}>
            <Input maxLength={120} />
          </Form.Item>
          <Form.Item
            label={t('storyboard.fields.description')}
            name="description"
            rules={[{required: true, message: t('storyboard.validation.shotDescription')}]}>
            <Input.TextArea autoSize={{minRows: 3, maxRows: 6}} maxLength={600} />
          </Form.Item>
          <Form.Item label={t('storyboard.characters')} name="characterIds" initialValue={[]}>
            <Select
              mode="multiple"
              options={characters.map(({id, title}) => ({label: title, value: id}))}
            />
          </Form.Item>
          <Form.Item label={t('storyboard.location')} name="locationId">
            <Select
              allowClear
              options={locations.map(({id, title}) => ({label: title, value: id}))}
            />
          </Form.Item>
          <Form.Item label={t('storyboard.visualReferences')} name="referenceIds" initialValue={[]}>
            <Select
              mode="multiple"
              options={references.map(({id, title}) => ({label: title, value: id}))}
            />
          </Form.Item>
          <div className="storyboard-inline-actions">
            <Button htmlType="submit" type="primary">
              {t('storyboard.manual.add')}
            </Button>
            <Button onClick={() => setManualOpen(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </Form>
      )}
    </section>
  );
}
