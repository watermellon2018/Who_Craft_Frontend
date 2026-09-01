import {LoadingOutlined, RobotOutlined} from '@ant-design/icons';
import {Alert, Button, Form, Input, Progress, Tooltip} from 'antd';
import React, {useCallback, useEffect, useId, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';

import type {StoryboardScene} from '../model';
import type {StoryboardShotMetadataField} from '../storyboardService';
import {
  calculateCoverage,
  createManualSourceDocument,
  selectionRangeWithin,
  sourceRangesForShot,
} from '../sourceSelection';
import type {SourceRange} from '../sourceSelection';
import type {NewShotInput} from '../useStoryboardWorkspace';
import ReadOnlyScreenplay from './ReadOnlyScreenplay';

interface ManualShotMarkupProps {
  scene: StoryboardScene;
  onAdd: (input: NewShotInput) => void;
  onComplete: () => void;
  onCancel?: () => void;
  onSuggestMetadata?: (field: StoryboardShotMetadataField, range: SourceRange) => Promise<string>;
  disabled?: boolean;
}

interface ShotFields {
  title: string;
  description: string;
}

interface SelectedSource {
  range: SourceRange;
  sceneId: string;
  text: string;
}

const MAX_DESCRIPTION_LENGTH = 4000;
const emptySuggestionState = (): Record<StoryboardShotMetadataField, boolean> => ({
  description: false,
  title: false,
});

export default function ManualShotMarkup({
  scene, onAdd, onComplete, onCancel, onSuggestMetadata, disabled = false,
}: ManualShotMarkupProps) {
  const {t} = useTranslation();
  const id = useId();
  const textRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef(0);
  const suggestionRequestRef = useRef<Record<StoryboardShotMetadataField, number>>({description: 0, title: 0});
  const suggestionActiveRef = useRef<Record<StoryboardShotMetadataField, boolean>>(emptySuggestionState());
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const [selection, setSelection] = useState<SelectedSource | null>(null);
  const [pending, setPending] = useState<SelectedSource | null>(null);
  const [creating, setCreating] = useState(false);
  const [sourceError, setSourceError] = useState(false);
  const [suggesting, setSuggesting] = useState(emptySuggestionState);
  const [suggestionErrors, setSuggestionErrors] = useState(emptySuggestionState);
  const [addedTitle, setAddedTitle] = useState('');
  const [form] = Form.useForm<ShotFields>();

  useEffect(() => {
    const suggestionRequests = suggestionRequestRef.current;
    requestRef.current += 1;
    suggestionRequests.title += 1;
    suggestionRequests.description += 1;
    suggestionActiveRef.current = emptySuggestionState();
    const root = textRef.current;
    const nativeSelection = root?.ownerDocument.getSelection();
    if (root && nativeSelection && (root.contains(nativeSelection.anchorNode) || root.contains(nativeSelection.focusNode))) {
      nativeSelection.removeAllRanges();
    }
    setSelection(null);
    setPending(null);
    setCreating(false);
    setSourceError(false);
    setSuggesting(emptySuggestionState());
    setSuggestionErrors(emptySuggestionState());
    setAddedTitle('');
    form.resetFields();
    return () => {
      requestRef.current += 1;
      suggestionRequests.title += 1;
      suggestionRequests.description += 1;
    };
  }, [form, scene.id, scene.text]);

  const selected = selection?.sceneId === scene.id && selection.text === scene.text ? selection : null;
  const confirmed = pending?.sceneId === scene.id && pending.text === scene.text ? pending : null;
  const coverageRanges = useMemo(() => scene.shots.flatMap((shot) => (
    String(shot.source?.document.sceneId) === scene.id ? sourceRangesForShot(shot, scene.text) : []
  )), [scene.id, scene.shots, scene.text]);
  const coverage = useMemo(() => calculateCoverage(scene.text, coverageRanges), [scene.text, coverageRanges]);
  const selectedText = confirmed
    ? Array.from(confirmed.text).slice(confirmed.range.start, confirmed.range.end).join('') : '';

  const captureSelection = useCallback(() => {
    if (disabled || pending || !textRef.current) return;
    const nativeSelection = textRef.current.ownerDocument.getSelection();
    const range = selectionRangeWithin(textRef.current, nativeSelection);
    if (range) {
      setSelection({range, sceneId: scene.id, text: scene.text});
      setAddedTitle('');
    } else {
      setSelection(null);
    }
  }, [disabled, pending, scene.id, scene.text]);

  useEffect(() => {
    const document = textRef.current?.ownerDocument;
    captureSelection();
    document?.addEventListener('selectionchange', captureSelection);
    return () => document?.removeEventListener('selectionchange', captureSelection);
  }, [captureSelection]);

  const selectAll = () => {
    if (!textRef.current || !scene.text.trim()) return;
    const document = textRef.current.ownerDocument;
    const range = document.createRange();
    range.selectNodeContents(textRef.current);
    const nativeSelection = document.getSelection();
    textRef.current.focus();
    nativeSelection?.removeAllRanges();
    nativeSelection?.addRange(range);
    setSelection({range: {start: 0, end: Array.from(scene.text).length}, sceneId: scene.id, text: scene.text});
    setAddedTitle('');
  };

  const confirmSelection = () => {
    if (disabled || pending || creating || !textRef.current) return false;
    const range = selectionRangeWithin(textRef.current, textRef.current.ownerDocument.getSelection());
    if (!range) {
      setSelection(null);
      return false;
    }
    const text = Array.from(scene.text).slice(range.start, range.end).join('');
    setPending({range, sceneId: scene.id, text: scene.text});
    setSourceError(false);
    form.setFieldsValue({
      title: t('storyboard.manualMarkup.defaultTitle', {number: scene.shots.length + 1}),
      description: text.length <= MAX_DESCRIPTION_LENGTH ? text : '',
    });
    return true;
  };

  const addShot = async (values: ShotFields) => {
    if (!confirmed || disabled || creating || suggesting.title || suggesting.description) return;
    const activeScene = scene;
    const request = ++requestRef.current;
    setCreating(true);
    setSourceError(false);
    try {
      const document = await createManualSourceDocument(activeScene);
      if (request !== requestRef.current || sceneRef.current.id !== activeScene.id
        || sceneRef.current.text !== activeScene.text) return;
      onAdd({
        title: values.title.trim(),
        description: values.description ?? '',
        source: {document, segmentIds: [], ranges: [{...confirmed.range}], origin: 'manual'},
      });
      setAddedTitle(values.title.trim());
      setPending(null);
      setSelection(null);
      form.resetFields();
      textRef.current?.ownerDocument.getSelection()?.removeAllRanges();
      textRef.current?.focus();
    } catch {
      if (request === requestRef.current) setSourceError(true);
    } finally {
      if (request === requestRef.current) setCreating(false);
    }
  };

  const suggestMetadata = async (field: StoryboardShotMetadataField) => {
    if (!confirmed || !onSuggestMetadata || disabled || creating || suggestionActiveRef.current[field]) return;
    const activeScene = scene;
    const activeRange = {...confirmed.range};
    const request = ++suggestionRequestRef.current[field];
    suggestionActiveRef.current[field] = true;
    setSuggesting((current) => ({...current, [field]: true}));
    setSuggestionErrors((current) => ({...current, [field]: false}));
    try {
      const value = await onSuggestMetadata(field, activeRange);
      if (
        request !== suggestionRequestRef.current[field]
        || sceneRef.current.id !== activeScene.id
        || sceneRef.current.text !== activeScene.text
      ) return;
      form.setFieldValue(field, value);
    } catch {
      if (request === suggestionRequestRef.current[field]) {
        setSuggestionErrors((current) => ({...current, [field]: true}));
      }
    } finally {
      if (request === suggestionRequestRef.current[field]) {
        suggestionActiveRef.current[field] = false;
        setSuggesting((current) => ({...current, [field]: false}));
      }
    }
  };

  const metadataButton = (field: StoryboardShotMetadataField) => (
    <Tooltip title={t(`storyboard.manualMarkup.ai.${field}.tooltip`)}>
      <Button
        aria-label={t(`storyboard.manualMarkup.ai.${field}.action`)}
        aria-busy={suggesting[field]}
        className="storyboard-manual__ai-button"
        disabled={disabled || creating || !onSuggestMetadata}
        icon={suggesting[field] ? <LoadingOutlined spin /> : <RobotOutlined />}
        onClick={() => suggestMetadata(field)}
        onMouseDown={(event) => event.preventDefault()}
        size="small"
        type="text"
      />
    </Tooltip>
  );

  return (
    <section className="storyboard-manual" aria-labelledby={`${id}-title`}>
      <div className="storyboard-section-heading">
        <div>
          <h3 id={`${id}-title`}>{t('storyboard.manualMarkup.title')}</h3>
          <p id={`${id}-help`}>{t('storyboard.manualMarkup.help')}</p>
          <p id={`${id}-shortcut`}>{t('storyboard.manualMarkup.shortcutHint')}</p>
        </div>
        {onCancel && <Button disabled={creating} onClick={onCancel}>{t('storyboard.manualMarkup.back')}</Button>}
      </div>
      <div className="storyboard-manual__coverage">
        <span>{t('storyboard.manualMarkup.coverage', {percent: coverage.percent, count: scene.shots.length})}</span>
        <Progress aria-label={t('storyboard.manualMarkup.coverageLabel')} percent={coverage.percent} showInfo={false} />
      </div>
      {!scene.text.trim() && <Alert message={t('storyboard.manualMarkup.empty')} showIcon type="info" />}
      <ReadOnlyScreenplay
        aria-describedby={`${id}-help ${id}-shortcut`}
        aria-label={t('storyboard.manualMarkup.script')}
        className="storyboard-manual__script"
        onKeyDown={(event) => {
          if (event.defaultPrevented || event.repeat || event.nativeEvent.isComposing
            || event.ctrlKey || event.altKey || event.metaKey) return;
          if ((event.code === 'KeyO' || event.key.toLowerCase() === 'o') && confirmSelection()) {
            event.preventDefault();
          }
        }}
        onKeyUp={captureSelection}
        onMouseUp={captureSelection}
        ref={textRef}
        role="document"
        ranges={coverageRanges}
        scriptBlocks={scene.scriptBlocks}
        tabIndex={0}
        text={scene.text}
      />
      <div className="storyboard-manual__selection-actions">
        <Button disabled={disabled || Boolean(confirmed) || !scene.text.trim()} onClick={selectAll}>
          {t('storyboard.manualMarkup.selectAll')}
        </Button>
        <Button
          aria-keyshortcuts="O"
          disabled={disabled || !selected || Boolean(confirmed)}
          onClick={confirmSelection}
          onMouseDown={(event) => event.preventDefault()}
          type="primary"
        >
          {t('storyboard.manualMarkup.createSelection')}
        </Button>
        {selected && <span>{t('storyboard.manualMarkup.selectionCount', {count: selected.range.end - selected.range.start})}</span>}
      </div>
      {confirmed && (
        <Form className="storyboard-manual__form" form={form} layout="vertical" onFinish={addShot}>
          {selectedText.length > MAX_DESCRIPTION_LENGTH && (
            <Alert message={t('storyboard.manualMarkup.longSelection')} showIcon type="info" />
          )}
          <Form.Item htmlFor={`${id}-shot-title`} label={t('storyboard.manualMarkup.titleLabel')}>
            <div className="storyboard-manual__ai-field storyboard-manual__ai-field--title">
              <Form.Item
                name="title"
                noStyle
                rules={[{required: true, whitespace: true, message: t('storyboard.validation.shotTitle')}]}
              >
                <Input id={`${id}-shot-title`} autoFocus disabled={creating || disabled || suggesting.title} maxLength={255} />
              </Form.Item>
              {metadataButton('title')}
            </div>
          </Form.Item>
          <Form.Item htmlFor={`${id}-shot-description`} label={t('storyboard.manualMarkup.descriptionLabel')}>
            <div className="storyboard-manual__ai-field storyboard-manual__ai-field--description">
              <Form.Item name="description" noStyle>
                <Input.TextArea id={`${id}-shot-description`} autoSize={{minRows: 2, maxRows: 6}}
                  disabled={creating || disabled || suggesting.description} maxLength={MAX_DESCRIPTION_LENGTH} />
              </Form.Item>
              {metadataButton('description')}
            </div>
          </Form.Item>
          {(['title', 'description'] as const).map((field) => suggestionErrors[field] && (
            <Alert key={field} message={t(`storyboard.manualMarkup.ai.${field}.error`)} showIcon type="error" />
          ))}
          {sourceError && <Alert message={t('storyboard.manualMarkup.hashError')} showIcon type="error" />}
          <div className="storyboard-inline-actions">
            <Button disabled={disabled || suggesting.title || suggesting.description} htmlType="submit" loading={creating} type="primary">
              {t('storyboard.manualMarkup.add')}
            </Button>
            <Button disabled={creating || suggesting.title || suggesting.description} onClick={() => {
              setPending(null); setSourceError(false); setSuggestionErrors(emptySuggestionState());
            }}>
              {t('storyboard.manualMarkup.cancelSelection')}
            </Button>
          </div>
        </Form>
      )}
      <p className="storyboard-manual__status" role="status">
        {addedTitle ? t('storyboard.manualMarkup.added', {title: addedTitle}) : ''}
      </p>
      <div className="storyboard-manual__footer">
        <Button disabled={disabled || creating || Boolean(confirmed) || !coverage.complete} onClick={onComplete} type="primary">
          {t('storyboard.manualMarkup.complete')}
        </Button>
      </div>
    </section>
  );
}
