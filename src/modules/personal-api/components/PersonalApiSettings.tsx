import {ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, KeyOutlined, PlusOutlined} from '@ant-design/icons';
import {Alert, Button, Input, Radio, Select, Spin, Switch, Tag} from 'antd';
import type {InputRef} from 'antd';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {
  createPersonalApiConnection,
  deletePersonalApiConnection,
  fetchPersonalApiSettings,
  saveGenerationPreference,
  updatePersonalApiConnection,
} from '../api/personalApi';
import type {
  GenerationModality,
  GenerationSource,
  PersonalApiConnection,
  PersonalApiPreference,
  PersonalApiProvider,
  PersonalApiSettings as Settings,
} from '../api/personalApi';
import '../personal-api.css';

const MODALITIES: GenerationModality[] = ['text', 'image', 'music', 'sound_effect'];
type Route = PersonalApiPreference['routes'][number];

interface ConnectionEditorProps {
  connection?: PersonalApiConnection;
  providers: PersonalApiProvider[];
  onCancel: () => void;
  onSave: (values: {name: string; provider: string; apiKey?: string}) => Promise<void>;
}

function ConnectionEditor({connection, providers, onCancel, onSave}: ConnectionEditorProps) {
  const {t} = useTranslation();
  const [name, setName] = useState(connection?.name ?? '');
  const [provider, setProvider] = useState(connection?.provider ?? providers[0]?.id ?? '');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [invalidField, setInvalidField] = useState('');
  const nameRef = useRef<InputRef>(null);
  const keyRef = useRef<InputRef>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setError('');
    setInvalidField('');
    if (!name.trim()) {
      setError(t('personalApi.errors.requiredName'));
      setInvalidField('name');
      nameRef.current?.focus();
      return;
    }
    if (!provider) {
      setError(t('personalApi.errors.requiredProvider'));
      setInvalidField('provider');
      return;
    }
    if (!connection && !apiKey.trim()) {
      setError(t('personalApi.errors.requiredKey'));
      setInvalidField('key');
      keyRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSave({name: name.trim(), provider, ...(apiKey.trim() ? {apiKey: apiKey.trim()} : {})});
      setApiKey('');
      onCancel();
    } catch {
      setError(t('personalApi.errors.save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="personal-api-editor" onSubmit={(event) => void submit(event)} autoComplete="off">
      <h4>{t(connection ? 'personalApi.editTitle' : 'personalApi.newConnection')}</h4>
      <div className="personal-api-editor__fields">
        <div className="personal-api-field">
          <label htmlFor="personal-api-name">{t('personalApi.name')}</label>
          <Input id="personal-api-name" ref={nameRef} value={name} maxLength={100} disabled={saving}
            placeholder={t('personalApi.namePlaceholder')} autoComplete="off"
            aria-invalid={invalidField === 'name'} aria-describedby={invalidField === 'name' ? 'personal-api-editor-error' : undefined}
            onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="personal-api-field">
          <label htmlFor="personal-api-provider">{t('personalApi.provider')}</label>
          <Select id="personal-api-provider" value={provider || undefined} disabled={saving || Boolean(connection)}
            aria-invalid={invalidField === 'provider'}
            options={providers.map((item) => ({value: item.id, label: item.label}))} onChange={setProvider} />
        </div>
        <div className="personal-api-field personal-api-editor__key">
          <label htmlFor="personal-api-key">{t(connection ? 'personalApi.replacementKey' : 'personalApi.key')}</label>
          <Input.Password id="personal-api-key" ref={keyRef} value={apiKey} disabled={saving} autoComplete="off"
            aria-invalid={invalidField === 'key'}
            aria-describedby={`personal-api-key-hint${invalidField === 'key' ? ' personal-api-editor-error' : ''}`}
            onChange={(event) => setApiKey(event.target.value)} />
          <p id="personal-api-key-hint" className="personal-api-hint">
            {connection ? `${t('personalApi.replacementHint')} ` : ''}{t('personalApi.keyHint')}
          </p>
        </div>
      </div>
      {error && <p id="personal-api-editor-error" role="alert" className="personal-api-error">{error}</p>}
      <div className="personal-api-actions">
        <Button type="primary" htmlType="submit" loading={saving}>{t('personalApi.save')}</Button>
        <Button disabled={saving} onClick={() => {setApiKey(''); onCancel();}}>{t('personalApi.cancel')}</Button>
      </div>
    </form>
  );
}

interface ModalityPreferencesProps {
  modality: GenerationModality;
  settings: Settings;
  onSaved: (preference: PersonalApiPreference) => void;
}

function ModalityPreferences({modality, settings, onSaved}: ModalityPreferencesProps) {
  const {t} = useTranslation();
  const initial = settings.preferences.find((item) => item.modality === modality);
  const [source, setSource] = useState<GenerationSource>(initial?.source ?? 'platform');
  const [routes, setRoutes] = useState<Route[]>(initial?.routes ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setSource(initial?.source ?? 'platform');
    setRoutes(initial?.routes ?? []);
  }, [initial]);
  const label = t(`personalApi.modalities.${modality}`);
  const models = settings.models.filter((model) => model.modality === modality);
  const connections = settings.connections.filter((connection) => (
    connection.isActive && models.some((model) => model.providers.includes(connection.provider))
  ));
  const routeAvailable = (route: Route) => {
    const connection = connections.find((item) => item.id === route.connectionId);
    return Boolean(connection && models.some((model) => model.key === route.modelKey && model.providers.includes(connection.provider)));
  };
  const nextRoute = connections.flatMap((connection) => models
    .filter((model) => model.providers.includes(connection.provider))
    .map((model) => ({connectionId: connection.id, modelKey: model.key})))
    .find((candidate) => !routes.some((route) => route.connectionId === candidate.connectionId && route.modelKey === candidate.modelKey));

  const changeRoutes = (next: Route[]) => {
    setRoutes(next);
    setSaved(false);
    setError('');
  };
  const changeRoute = (index: number, update: Partial<Route>) => {
    changeRoutes(routes.map((route, position) => position === index ? {...route, ...update} : route));
  };
  const move = (index: number, direction: number) => {
    const next = [...routes];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    changeRoutes(next);
  };
  const save = async () => {
    if (saving) return;
    setError('');
    setSaved(false);
    if (new Set(routes.map((route) => `${route.connectionId}:${route.modelKey}`)).size !== routes.length) {
      setError(t('personalApi.errors.duplicateRoute'));
      return;
    }
    setSaving(true);
    try {
      onSaved(await saveGenerationPreference(modality, {source, routes}));
      setSaved(true);
    } catch {
      setError(t('personalApi.errors.save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="personal-api-modality" aria-labelledby={`personal-api-${modality}-title`}>
      <h4 id={`personal-api-${modality}-title`}>{label}</h4>
      <Radio.Group aria-label={t('personalApi.source', {modality: label})} value={source} disabled={saving}
        onChange={(event) => {setSource(event.target.value); setSaved(false); setError('');}}>
        <Radio value="platform">{t('personalApi.platform')}</Radio>
        <Radio value="personal">{t('personalApi.personal')}</Radio>
      </Radio.Group>
      {source === 'platform' ? <p className="personal-api-hint">{t('personalApi.platformHint')}</p> : (
        <>
          <p className="personal-api-hint">{t('personalApi.priorityHint')}</p>
          {!routes.some(routeAvailable) && <Alert type="warning" showIcon message={t('personalApi.noRoutes')} />}
          {routes.length > 0 && routes.some((route) => !routeAvailable(route)) && (
            <Alert type="warning" showIcon message={t('personalApi.unavailableRoute')} />
          )}
          <ol className="personal-api-routes">
            {routes.map((route, index) => {
              const connection = settings.connections.find((item) => item.id === route.connectionId);
              const compatibleModels = models.filter((model) => model.providers.includes(connection?.provider ?? ''));
              const routeOptions = connections.map((item) => ({value: item.id, label: item.name}));
              if (!connections.some((item) => item.id === route.connectionId)) {
                routeOptions.push({value: route.connectionId, label: `${connection?.name ?? t('personalApi.unavailable')} · ${t('personalApi.inactive')}`});
              }
              const modelOptions = compatibleModels.map((model) => ({value: model.key,
                label: model.isFree ? t('personalApi.freeModel', {model: model.label}) : model.label}));
              if (!compatibleModels.some((model) => model.key === route.modelKey)) {
                modelOptions.push({value: route.modelKey, label: t('personalApi.missingModel')});
              }
              return (
                <li key={index} className="personal-api-route">
                  <span className="personal-api-route__position" aria-hidden="true">{index + 1}</span>
                  <div className="personal-api-field">
                    <label htmlFor={`personal-api-${modality}-connection-${index}`}>{t('personalApi.routeConnection', {position: index + 1})}</label>
                    <Select id={`personal-api-${modality}-connection-${index}`} value={route.connectionId} disabled={saving}
                      options={routeOptions} onChange={(connectionId) => {
                        const selected = connections.find((item) => item.id === connectionId);
                        const selectedModel = models.find((model) => model.providers.includes(selected?.provider ?? ''));
                        changeRoute(index, {connectionId, modelKey: selectedModel?.key ?? ''});
                      }} />
                  </div>
                  <div className="personal-api-field">
                    <label htmlFor={`personal-api-${modality}-model-${index}`}>{t('personalApi.routeModel', {position: index + 1})}</label>
                    <Select id={`personal-api-${modality}-model-${index}`} value={route.modelKey} disabled={saving}
                      options={modelOptions} onChange={(modelKey) => changeRoute(index, {modelKey})} />
                  </div>
                  <div className="personal-api-route__actions">
                    <Button icon={<ArrowUpOutlined aria-hidden="true" />} aria-label={t('personalApi.moveUp', {position: index + 1})}
                      disabled={saving || index === 0} onClick={() => move(index, -1)} />
                    <Button icon={<ArrowDownOutlined aria-hidden="true" />} aria-label={t('personalApi.moveDown', {position: index + 1})}
                      disabled={saving || index === routes.length - 1} onClick={() => move(index, 1)} />
                    <Button danger icon={<DeleteOutlined aria-hidden="true" />} aria-label={t('personalApi.removeRoute', {position: index + 1})}
                      disabled={saving} onClick={() => changeRoutes(routes.filter((_, position) => position !== index))} />
                  </div>
                </li>
              );
            })}
          </ol>
          <div>
            <Button icon={<PlusOutlined aria-hidden="true" />} disabled={saving || !nextRoute} onClick={() => nextRoute && changeRoutes([...routes, nextRoute])}>
              {t('personalApi.addRoute')}
            </Button>
          </div>
          {!connections.length && <p className="personal-api-hint">{t('personalApi.noCompatibleConnections')}</p>}
        </>
      )}
      {error && <p role="alert" className="personal-api-error">{error}</p>}
      <div className="personal-api-actions">
        <Button loading={saving} aria-label={t('personalApi.saveModality', {modality: label})} onClick={() => void save()}>
          {t('personalApi.save')}
        </Button>
        <span role="status" className="personal-api-hint">{saved ? t('personalApi.saved') : ''}</span>
      </div>
    </section>
  );
}

export default function PersonalApiSettings() {
  const {t} = useTranslation();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const loaded = await fetchPersonalApiSettings();
      if (mounted.current) setSettings(loaded);
    } catch {
      if (mounted.current) setLoadError(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {mounted.current = false;};
  }, [load]);

  const saveConnection = async (values: {name: string; provider: string; apiKey?: string}) => {
    const connection = editing === 'new'
      ? await createPersonalApiConnection({...values, apiKey: values.apiKey ?? ''})
      : await updatePersonalApiConnection(editing ?? '', {name: values.name, ...(values.apiKey ? {apiKey: values.apiKey} : {})});
    setSettings((current) => current && ({...current, connections: editing === 'new'
      ? [...current.connections, connection]
      : current.connections.map((item) => item.id === connection.id ? connection : item)}));
    setNotice(t('personalApi.connectionSaved'));
  };
  const toggle = async (connection: PersonalApiConnection, isActive: boolean) => {
    if (busy) return;
    setBusy(connection.id);
    setError('');
    setNotice('');
    try {
      const updated = await updatePersonalApiConnection(connection.id, {isActive});
      setSettings((current) => current && ({...current,
        connections: current.connections.map((item) => item.id === updated.id ? updated : item)}));
      setNotice(t('personalApi.connectionUpdated'));
    } catch {
      setError(t('personalApi.errors.update'));
    } finally {
      setBusy(null);
    }
  };
  const remove = async (id: string) => {
    if (busy) return;
    setBusy(id);
    setError('');
    setNotice('');
    try {
      await deletePersonalApiConnection(id);
      setDeleting(null);
      // Revocation also removes this connection from the saved modality routes.
      await load();
      setNotice(t('personalApi.deleted'));
    } catch {
      setError(t('personalApi.errors.remove'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="profile-settings-card personal-api-settings rounded-2xl p-5" aria-labelledby="personal-api-title">
      <div className="profile-settings-section-heading">
        <KeyOutlined aria-hidden="true" />
        <div><h2 id="personal-api-title">{t('personalApi.title')}</h2><p>{t('personalApi.description')}</p></div>
      </div>
      {loading && <div role="status" aria-label={t('personalApi.loading')} className="personal-api-loading"><Spin /></div>}
      {loadError && !loading && <Alert type="error" showIcon message={t('personalApi.errors.load')}
        action={<Button onClick={() => void load()}>{t('personalApi.retry')}</Button>} />}
      {settings && !loading && !loadError && (
        <>
          {!settings.hasPaidSubscription && <Alert type="info" showIcon message={t('personalApi.subscriptionNotice')} />}
          {!settings.storageAvailable && <Alert type="warning" showIcon message={t('personalApi.storageUnavailable')} />}
          <section className="personal-api-section" aria-labelledby="personal-api-connections-title">
            <div className="personal-api-section__heading">
              <h3 id="personal-api-connections-title">{t('personalApi.connections')}</h3>
              <Button icon={<PlusOutlined aria-hidden="true" />} disabled={!settings.storageAvailable || Boolean(editing) || Boolean(busy)}
                onClick={() => {setEditing('new'); setDeleting(null); setError(''); setNotice('');}}>{t('personalApi.add')}</Button>
            </div>
            <p className="personal-api-hint">{t('personalApi.connectionsHint')}</p>
            {!settings.connections.length && !editing && <p className="personal-api-empty">{t('personalApi.empty')}</p>}
            <ul className="personal-api-connections">
              {settings.connections.map((connection) => (
                <li key={connection.id} className="personal-api-connection">
                  <div className="personal-api-connection__main">
                    <div className="personal-api-connection__label">
                      <strong>{connection.name}</strong>
                      <span className="personal-api-hint">
                        {settings.providers.find((provider) => provider.id === connection.provider)?.label ?? connection.provider}
                        {' · '}<span className="personal-api-key-hint">{connection.keyHint}</span>
                      </span>
                    </div>
                    <Tag>{t(connection.isActive ? 'personalApi.active' : 'personalApi.inactive')}</Tag>
                    <div className="personal-api-actions">
                      <Switch checked={connection.isActive} loading={busy === connection.id} disabled={Boolean(busy) || Boolean(editing) || (!settings.storageAvailable && !connection.isActive)}
                        aria-label={t('personalApi.toggle', {name: connection.name})} onChange={(value) => void toggle(connection, value)} />
                      <Button disabled={Boolean(editing) || Boolean(busy) || !settings.storageAvailable}
                        aria-label={t('personalApi.editConnection', {name: connection.name})}
                        onClick={() => {setEditing(connection.id); setDeleting(null); setError(''); setNotice('');}}>{t('personalApi.edit')}</Button>
                      <Button danger disabled={Boolean(editing) || Boolean(busy)} aria-label={t('personalApi.removeConnection', {name: connection.name})}
                        onClick={() => {setDeleting(connection.id); setError(''); setNotice('');}}>{t('personalApi.remove')}</Button>
                    </div>
                  </div>
                  {deleting === connection.id && <div className="personal-api-delete" role="group" aria-label={t('personalApi.deleteQuestion')}>
                    <strong>{t('personalApi.deleteQuestion')}</strong><p className="personal-api-hint">{t('personalApi.deleteHint')}</p>
                    <div className="personal-api-actions">
                      <Button danger loading={busy === connection.id} onClick={() => void remove(connection.id)}>{t('personalApi.remove')}</Button>
                      <Button disabled={Boolean(busy)} onClick={() => setDeleting(null)}>{t('personalApi.cancel')}</Button>
                    </div>
                  </div>}
                  {editing === connection.id && <ConnectionEditor key={connection.id} connection={connection} providers={settings.providers}
                    onCancel={() => setEditing(null)} onSave={saveConnection} />}
                </li>
              ))}
            </ul>
            {editing === 'new' && <ConnectionEditor key="new" providers={settings.providers} onCancel={() => setEditing(null)} onSave={saveConnection} />}
            <p className="personal-api-hint">{t('personalApi.keyUnverified')}</p>
            {error && <p role="alert" className="personal-api-error">{error}</p>}
            <span role="status" className="personal-api-hint">{notice}</span>
          </section>
          <section className="personal-api-section" aria-labelledby="personal-api-preferences-title">
            <h3 id="personal-api-preferences-title">{t('personalApi.preferences')}</h3>
            <p className="personal-api-hint">{t('personalApi.preferencesHint')}</p>
            <div className="personal-api-modalities">
              {MODALITIES.map((modality) => <ModalityPreferences key={modality} modality={modality} settings={settings}
                onSaved={(preference) => setSettings((current) => current && ({...current,
                  preferences: [...current.preferences.filter((item) => item.modality !== modality), preference]}))} />)}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
