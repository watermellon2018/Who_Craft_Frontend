import {ArrowLeftOutlined, DeleteOutlined, MenuOutlined, MessageOutlined, SendOutlined} from '@ant-design/icons';
import {Button, Input, Spin} from 'antd';
import type {TextAreaRef} from 'antd/es/input/TextArea';
import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {v4 as uuid} from 'uuid';

import {API_CONSTRAINTS} from '../../api/generated/contracts';
import type {MessagingMessage, MessagingUser} from '../../api/generated/contracts';
import {getAuthGeneration} from '../../api/http';
import PathConstants, {messagingConversationPath} from '../../routes/pathConstant';
import {craftModal} from '../../theme/CraftModalHost';
import ProfileSidebar from '../profile/components/ProfileSidebar';
import {messagingApi, messagingErrorStatus} from './api';
import {MessageTimeline} from './MessageTimeline';
import {notifyMessagingChanged, useMessagingSession} from './session';
import {useConversation} from './useConversation';
import {useConversations} from './useConversations';
import {UserAvatar} from './UserAvatar';
import {UserSearch} from './UserSearch';
import '../profile/profile.css';
import './messaging.css';

interface Draft {
  text: string;
  pending?: {text: string; clientId: string};
  edit?: {id: number; text: string; version: number};
  busy?: boolean;
  error?: string;
}

const emptyDraft: Draft = {text: ''};

function MessagingWorkspace({generation}: {generation: number}) {
  const {t, i18n} = useTranslation();
  const {conversationId} = useParams<{conversationId: string}>();
  const navigate = useNavigate();
  const conversations = useConversations(generation);
  const chat = useConversation(conversationId, generation, conversations.update);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [sentCount, setSentCount] = useState(0);
  const draftsRef = useRef<Record<string, Draft>>({});
  const composer = useRef<TextAreaRef>(null);
  const alive = useRef(true);
  const activeId = useRef(conversationId);
  const navigationIntent = useRef(0);
  const modal = useRef<ReturnType<typeof craftModal.confirm> | null>(null);
  activeId.current = conversationId;

  useEffect(() => {
    alive.current = true;
    const connectionChanged = () => setOnline(navigator.onLine);
    window.addEventListener('online', connectionChanged);
    window.addEventListener('offline', connectionChanged);
    return () => {
      alive.current = false;
      modal.current?.destroy();
      window.removeEventListener('online', connectionChanged);
      window.removeEventListener('offline', connectionChanged);
    };
  }, []);

  useEffect(() => {
    ++navigationIntent.current;
    setOpening(null);
    setActionError(null);
    modal.current?.destroy();
    setConfirming(false);
  }, [conversationId]);

  const isCurrent = () => alive.current && generation === getAuthGeneration();
  const setDraft = (id: string, update: (draft: Draft) => Draft) => {
    const next = {...draftsRef.current, [id]: update(draftsRef.current[id] || emptyDraft)};
    draftsRef.current = next;
    setDrafts(next);
  };
  const draft = conversationId ? drafts[conversationId] || emptyDraft : emptyDraft;
  const text = draft.edit?.text ?? draft.text;
  const characterCount = Array.from(text.trim()).length;
  const conversation = chat.snapshot?.conversation;
  const peerName = (peer: MessagingUser) => peer.is_active ? peer.display_name || peer.username : t('messaging.inactiveUser');
  const editedMessage = draft.edit ? chat.snapshot?.messages.find((item) => item.id === draft.edit?.id) : null;
  const editUnavailable = Boolean(draft.edit && (!editedMessage || editedMessage.deleted_at));
  const canCompose = draft.edit ? !editUnavailable : Boolean(conversation?.can_send);
  const formatter = new Intl.DateTimeFormat(i18n.language, {day: 'numeric', month: 'short'});

  const openUser = async (user: MessagingUser) => {
    if (opening !== null) return;
    const intent = ++navigationIntent.current;
    setOpening(user.id);
    setActionError(null);
    try {
      const result = await messagingApi.create(user.id, {generation});
      if (!isCurrent() || navigationIntent.current !== intent) return;
      conversations.update(result);
      navigate(messagingConversationPath(result.id));
      void conversations.refresh();
    } catch {
      if (isCurrent() && navigationIntent.current === intent) setActionError('messaging.errors.open');
    } finally {
      if (isCurrent() && navigationIntent.current === intent) setOpening(null);
    }
  };

  const submit = async () => {
    const id = conversationId;
    if (!id || !conversation || !isCurrent()) return;
    const current = draftsRef.current[id] || emptyDraft;
    if (current.busy || (current.edit ? editUnavailable : !conversation.can_send)) return;
    const outgoing = (current.edit?.text ?? current.text).trim();
    if (!outgoing || Array.from(outgoing).length > API_CONSTRAINTS.messagingTextMaxLength) {
      setDraft(id, (value) => ({...value, error: !outgoing ? 'messaging.errors.empty' : 'messaging.errors.tooLong'}));
      composer.current?.focus();
      return;
    }
    const edit = current.edit;
    const clientId = current.pending?.text === outgoing ? current.pending.clientId : uuid();
    setDraft(id, (value) => ({...value, busy: true, error: undefined, ...(!edit ? {pending: {text: outgoing, clientId}} : {})}));
    try {
      const result = edit
        ? await messagingApi.edit(id, edit.id, outgoing, edit.version, {generation})
        : await messagingApi.send(id, outgoing, clientId, {generation});
      if (!isCurrent()) return;
      conversations.update(result.conversation);
      chat.acceptMutation(result);
      setDraft(id, (value) => ({...value, busy: false, error: undefined, ...(edit ? {edit: undefined} : {text: '', pending: undefined})}));
      if (activeId.current === id && !edit) setSentCount((value) => value + 1);
      notifyMessagingChanged();
      void conversations.refresh();
    } catch (error) {
      if (!isCurrent()) return;
      const status = messagingErrorStatus(error);
      const code = (error as {response?: {data?: {error?: {code?: string}}}})?.response?.data?.error?.code;
      setDraft(id, (value) => ({...value, busy: false,
        ...(code === 'MESSAGE_CLEARED' ? {pending: undefined} : {}),
        error: code === 'MESSAGE_CLEARED' ? 'messaging.errors.clearedRetry'
          : edit && status === 409 ? 'messaging.errors.editConflict'
            : status === 404 ? 'messaging.errors.unavailable'
              : edit ? 'messaging.errors.edit' : 'messaging.errors.send',
      }));
      if (activeId.current === id) void chat.refresh();
    }
  };

  const confirmDelete = (message: MessagingMessage) => {
    if (!conversationId || !message.is_own) return;
    const id = conversationId;
    setConfirming(true);
    modal.current = craftModal.confirm({
      title: t('messaging.deleteConfirm.title'), content: t('messaging.deleteConfirm.body'),
      okText: t('messaging.deleteMessage'), cancelText: t('messaging.cancel'), okButtonProps: {danger: true},
      afterClose: () => {if (alive.current) setConfirming(false);},
      onOk: async () => {
        if (!isCurrent()) return;
        try {
          const result = await messagingApi.remove(id, message.id, {generation});
          if (!isCurrent()) return;
          chat.acceptMutation(result);
          conversations.update(result.conversation);
          setActionError(null);
          notifyMessagingChanged();
        } catch (error) {
          if (isCurrent()) setActionError('messaging.errors.delete');
          throw error;
        }
      },
    });
  };

  const confirmClear = () => {
    if (!conversationId) return;
    const id = conversationId;
    setConfirming(true);
    modal.current = craftModal.confirm({
      title: t('messaging.clearConfirm.title'), content: t('messaging.clearConfirm.body'),
      okText: t('messaging.clearChat'), cancelText: t('messaging.cancel'), okButtonProps: {danger: true},
      afterClose: () => {if (alive.current) setConfirming(false);},
      onOk: async () => {
        if (!isCurrent()) return;
        try {
          const result = await messagingApi.clear(id, {generation});
          if (!isCurrent()) return;
          chat.acceptConversation(result);
          conversations.update(result);
          setDraft(id, () => ({text: ''}));
          notifyMessagingChanged();
          if (activeId.current === id) navigate(PathConstants.PROFILE_MESSAGES);
          void conversations.refresh();
        } catch (error) {
          if (isCurrent()) setActionError('messaging.errors.clear');
          throw error;
        }
      },
    });
  };

  return <div className="messaging-shell">
    <ProfileSidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    <main className="messaging-main">
      <header className="messaging-page-header">
        <Button className="messaging-profile-menu" type="text" icon={<MenuOutlined aria-hidden />} aria-label={t('messaging.menu')} onClick={() => setSidebarOpen(true)} />
        <div><h1>{t('messaging.title')}</h1><p>{t('messaging.subtitle')}</p></div>
      </header>
      {!online && <div className="messaging-error" role="status">{t('messaging.offline')}</div>}
      {actionError && <div className="messaging-error" role="alert">{t(actionError)} <button type="button" onClick={() => setActionError(null)}>{t('messaging.dismiss')}</button></div>}
      <div className={`messaging-workspace ${conversationId ? 'messaging-workspace--selected' : ''}`}>
        <section className="messaging-inbox" aria-label={t('messaging.conversations')}>
          <UserSearch generation={generation} opening={opening} onOpen={(user) => void openUser(user)}>
            <div className="messaging-list profile-scroll">
              {conversations.error && <div className="messaging-error" role="alert">{t('messaging.errors.list')} <button type="button" onClick={() => void conversations.refresh()}>{t('messaging.retry')}</button></div>}
              {!conversations.items.length && conversations.loading && <div className="messaging-list-status" role="status"><Spin /> {t('messaging.loading')}</div>}
              {!conversations.loading && !conversations.items.length && !conversations.error && <div className="messaging-empty"><MessageOutlined aria-hidden /><h2>{t('messaging.empty.title')}</h2><p>{t('messaging.empty.body')}</p></div>}
              {conversations.items.map((item) => <Link key={item.id} to={messagingConversationPath(item.id)}
                onClick={() => {++navigationIntent.current;}}
                className={`messaging-person ${item.id === conversationId ? 'messaging-person--active' : ''}`} aria-current={item.id === conversationId ? 'page' : undefined}>
                <UserAvatar user={item.peer} />
                <span className="messaging-person-copy"><strong>{peerName(item.peer)}</strong><small>
                  {item.last_message ? item.last_message.deleted_at ? t('messaging.deleted')
                    : `${item.last_message.is_own ? `${t('messaging.you')}: ` : ''}${item.last_message.text}` : t('messaging.noMessages')}
                </small></span>
                <span className="messaging-person-meta"><time dateTime={item.updated_at}>{formatter.format(new Date(item.updated_at))}</time>
                  {item.unread_count > 0 && <span className="messaging-unread-badge" aria-label={t('messaging.unread', {count: item.unread_count})}>{item.unread_count > 99 ? '99+' : item.unread_count}</span>}
                </span>
              </Link>)}
              {conversations.items.length < conversations.total && <button type="button" className="messaging-more" disabled={conversations.loading} onClick={conversations.loadMore}>{t('messaging.moreConversations')}</button>}
            </div>
          </UserSearch>
        </section>
        <section className="messaging-detail" aria-label={t('messaging.history')}>
          {!conversationId ? <div className="messaging-empty messaging-empty--detail"><MessageOutlined aria-hidden /><h2>{t('messaging.select.title')}</h2><p>{t('messaging.select.body')}</p></div> : <>
            <header className="messaging-chat-header">
              <Link to={PathConstants.PROFILE_MESSAGES} className="messaging-back" aria-label={t('messaging.back')}><ArrowLeftOutlined aria-hidden /></Link>
              {conversation && <><UserAvatar user={conversation.peer} /><div className="messaging-chat-title"><h2>{peerName(conversation.peer)}</h2><p>{conversation.peer.is_active ? `@${conversation.peer.username}` : t('messaging.inactiveHint')}</p></div>
                <Button type="text" icon={<DeleteOutlined aria-hidden />} onClick={confirmClear} disabled={confirming || draft.busy}
                  aria-label={t('messaging.clearChat')} title={t('messaging.clearChat')} /></>}
            </header>
            {chat.loading && <div className="messaging-empty" role="status"><Spin />{t('messaging.loading')}</div>}
            {chat.loadError && <div className="messaging-empty" role="alert"><p>{t(chat.loadError === 'unavailable' ? 'messaging.errors.unavailable' : 'messaging.errors.history')}</p><Button onClick={() => void chat.refresh()}>{t('messaging.retry')}</Button></div>}
            {chat.syncError && <div className="messaging-error" role="status">{t('messaging.errors.sync')} <button type="button" onClick={() => void chat.refresh()}>{t('messaging.retry')}</button></div>}
            {chat.snapshot && <>
              <MessageTimeline snapshot={chat.snapshot} olderLoading={chat.olderLoading} paused={confirming || Boolean(draft.edit) || Boolean(draft.busy)} sentCount={sentCount}
                onOlder={chat.loadMore} onRead={chat.markRead} onDelete={confirmDelete} onEdit={(item) => {
                  if (!conversationId) return;
                  setDraft(conversationId, (value) => ({...value, edit: {id: item.id, text: item.text, version: item.version}, error: undefined}));
                  window.setTimeout(() => composer.current?.focus(), 0);
                }} />
              <form className="messaging-composer" onSubmit={(event) => {event.preventDefault(); void submit();}}>
                {draft.edit && <div className="messaging-editing"><span>{t('messaging.editing')}</span><Button type="text" disabled={draft.busy} onClick={() => {
                  if (conversationId) setDraft(conversationId, (value) => ({...value, edit: undefined, error: undefined}));
                }}>{t('messaging.cancel')}</Button></div>}
                {conversation && !conversation.can_send && !draft.edit && <p className="messaging-composer-notice">{t('messaging.inactiveHint')}</p>}
                {editUnavailable && <p className="messaging-composer-notice" role="status">{t('messaging.errors.editUnavailable')}</p>}
                <label className="messaging-sr-only" htmlFor="messaging-text">{t(draft.edit ? 'messaging.editing' : 'messaging.write')}</label>
                <div className="messaging-compose-row">
                  <Input.TextArea ref={composer} id="messaging-text" name="message" value={text} autoSize={{minRows: 1, maxRows: 6}}
                    disabled={draft.busy || (!draft.edit && !conversation?.can_send)} readOnly={editUnavailable} placeholder={t('messaging.write')}
                    aria-invalid={Boolean(draft.error)} aria-describedby={draft.error ? 'messaging-draft-error messaging-compose-hint' : 'messaging-compose-hint'}
                    onChange={(event) => {if (conversationId) setDraft(conversationId, (value) => ({...value, error: undefined,
                      ...(value.edit ? {edit: {...value.edit, text: event.target.value}} : {text: event.target.value}),
                    }));}}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                        event.preventDefault(); void submit();
                      }
                    }} />
                  <Button type="primary" htmlType="submit" loading={draft.busy} disabled={!canCompose} icon={<SendOutlined aria-hidden />}>{t(draft.edit ? 'messaging.save' : 'messaging.send')}</Button>
                </div>
                <div className="messaging-compose-hint" id="messaging-compose-hint"><span>{t('messaging.keyboard')}</span><span className={characterCount > API_CONSTRAINTS.messagingTextMaxLength ? 'messaging-limit-error' : ''}>{characterCount} / {API_CONSTRAINTS.messagingTextMaxLength}</span></div>
                {draft.error && <p className="messaging-draft-error" id="messaging-draft-error" role="alert">{t(draft.error)}</p>}
              </form>
            </>}
          </>}
        </section>
      </div>
    </main>
  </div>;
}

export default function MessagesPage() {
  const {generation, authenticated} = useMessagingSession();
  return authenticated ? <MessagingWorkspace key={generation} generation={generation} /> : null;
}
