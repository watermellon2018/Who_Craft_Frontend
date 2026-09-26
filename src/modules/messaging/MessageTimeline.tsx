import {DeleteOutlined, DownOutlined, EditOutlined} from '@ant-design/icons';
import {Button, Spin} from 'antd';
import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';

import type {MessagingMessage} from '../../api/generated/contracts';
import {canReadVisibleConversation} from './session';
import type {ConversationSnapshot} from './state';

interface Props {
  snapshot: ConversationSnapshot;
  olderLoading: boolean;
  paused: boolean;
  sentCount: number;
  onOlder: () => Promise<void>;
  onRead: (sequence: number) => Promise<void>;
  onEdit: (message: MessagingMessage) => void;
  onDelete: (message: MessagingMessage) => void;
}

export function MessageTimeline({snapshot, olderLoading, paused, sentCount, onOlder, onRead, onEdit, onDelete}: Props) {
  const {t, i18n} = useTranslation();
  const pane = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const anchor = useRef<{id: string; offset: number} | null>(null);
  const previousConversation = useRef('');
  const previousSent = useRef(sentCount);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const {conversation, messages} = snapshot;
  const formatter = new Intl.DateTimeFormat(i18n.language, {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'});

  const captureAnchor = useCallback(() => {
    const element = pane.current;
    if (!element) return;
    stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 60;
    setAwayFromBottom(!stickToBottom.current);
    const top = element.getBoundingClientRect().top;
    const visible = Array.from(element.querySelectorAll<HTMLElement>('[data-message-id]')).find((item) => item.getBoundingClientRect().bottom > top);
    anchor.current = visible ? {id: visible.dataset.messageId || '', offset: visible.getBoundingClientRect().top - top} : null;
  }, []);

  const readVisible = useCallback(() => {
    const element = pane.current;
    if (!element || paused || !canReadVisibleConversation()) return;
    const bounds = element.getBoundingClientRect();
    if (bounds.height <= 0) return;
    const rows = Array.from(element.querySelectorAll<HTMLElement>('[data-incoming-sequence]'));
    let sequence = 0;
    rows.forEach((row) => {
      const rect = row.getBoundingClientRect();
      if (rect.top < bounds.bottom && rect.bottom > bounds.top) sequence = Math.max(sequence, Number(row.dataset.incomingSequence));
    });
    if (sequence > conversation.read_through) void onRead(sequence);
  }, [conversation.read_through, onRead, paused]);

  useLayoutEffect(() => {
    const element = pane.current;
    if (!element) return;
    const switched = previousConversation.current !== conversation.id;
    if (switched || previousSent.current !== sentCount || stickToBottom.current) element.scrollTop = element.scrollHeight;
    else if (anchor.current) {
      const row = element.querySelector<HTMLElement>(`[data-message-id="${anchor.current.id}"]`);
      if (row) element.scrollTop += row.getBoundingClientRect().top - element.getBoundingClientRect().top - anchor.current.offset;
    }
    previousConversation.current = conversation.id;
    previousSent.current = sentCount;
    captureAnchor();
  }, [captureAnchor, conversation.id, messages, olderLoading, sentCount]);

  useEffect(() => {
    const timer = window.setTimeout(readVisible, 0);
    window.addEventListener('focus', readVisible);
    window.addEventListener('resize', readVisible);
    document.addEventListener('visibilitychange', readVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', readVisible);
      window.removeEventListener('resize', readVisible);
      document.removeEventListener('visibilitychange', readVisible);
    };
  }, [messages, readVisible]);

  return <div className="messaging-timeline-wrap">
    <div className="messaging-timeline profile-scroll" ref={pane} tabIndex={0}
      aria-label={t('messaging.history')} onScroll={() => {captureAnchor(); readVisible();}}>
      {snapshot.nextBefore !== null && <div className="messaging-older"><Button loading={olderLoading} onClick={() => void onOlder()}>{t('messaging.older')}</Button></div>}
      {!messages.length && <div className="messaging-empty"><p>{conversation.cleared_through > 0 ? t('messaging.cleared') : t('messaging.firstMessage')}</p></div>}
      <ol className="messaging-message-list" aria-label={t('messaging.history')}>
        {messages.map((item) => <li key={item.id} data-message-id={item.id}
          data-incoming-sequence={!item.is_own && !item.deleted_at ? item.sequence : undefined}
          className={`messaging-message ${item.is_own ? 'messaging-message--own' : ''}`}>
          <div className={`messaging-bubble ${item.deleted_at ? 'messaging-bubble--deleted' : ''}`}>
            <p className="messaging-text">{item.deleted_at ? t('messaging.deleted') : item.text}</p>
            <div className="messaging-message-meta">
              {item.edited_at && !item.deleted_at && <span>{t('messaging.edited')}</span>}
              <time dateTime={item.created_at} title={new Date(item.created_at).toLocaleString(i18n.language)}>{formatter.format(new Date(item.created_at))}</time>
              {item.is_own && !item.deleted_at && <span>{item.sequence <= conversation.peer_read_through ? t('messaging.read') : t('messaging.sent')}</span>}
            </div>
          </div>
          {item.is_own && !item.deleted_at && <div className="messaging-message-actions">
            <Button type="text" icon={<EditOutlined aria-hidden />} aria-label={t('messaging.editMessage')} title={t('messaging.editMessage')}
              disabled={paused} onClick={() => onEdit(item)} />
            <Button type="text" icon={<DeleteOutlined aria-hidden />} aria-label={t('messaging.deleteMessage')} title={t('messaging.deleteMessage')}
              disabled={paused} onClick={() => onDelete(item)} />
          </div>}
        </li>)}
      </ol>
      {olderLoading && <span className="messaging-sr-only" role="status"><Spin />{t('messaging.loading')}</span>}
    </div>
    {awayFromBottom && <Button className="messaging-to-bottom" icon={<DownOutlined aria-hidden />} onClick={() => {
      if (pane.current) pane.current.scrollTop = pane.current.scrollHeight;
      captureAnchor(); readVisible();
    }}>{t('messaging.latest')}</Button>}
  </div>;
}
