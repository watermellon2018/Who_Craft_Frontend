import {Input, Spin} from 'antd';
import {SearchOutlined} from '@ant-design/icons';
import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';

import type {MessagingUser} from '../../api/generated/contracts';
import {getAuthGeneration} from '../../api/http';
import {messagingApi} from './api';
import {UserAvatar} from './UserAvatar';

interface Props {
  generation: number;
  opening: number | null;
  onOpen: (user: MessagingUser) => void;
  children: React.ReactNode;
}

export function UserSearch({generation, opening, onOpen, children}: Props) {
  const {t} = useTranslation();
  const [query, setQuery] = useState('');
  const [pageCount, setPageCount] = useState(1);
  const [results, setResults] = useState<MessagingUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const normalized = query.trim().replace(/^@/, '');

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setResults([]);
    setTotal(0);
    setError(false);
    if (Array.from(normalized).length < 2 || Array.from(normalized).length > 100) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const users = new Map<number, MessagingUser>();
        let resultTotal = 0;
        for (let page = 0; page < pageCount; page += 1) {
          const result = await messagingApi.users(normalized, page * 30, {generation, signal: controller.signal});
          if (!alive || generation !== getAuthGeneration()) return;
          result.items.forEach((user) => users.set(user.id, user));
          resultTotal = result.total;
          if ((page + 1) * 30 >= resultTotal) break;
        }
        setResults(Array.from(users.values()));
        setTotal(resultTotal);
      } catch {
        if (alive && generation === getAuthGeneration()) setError(true);
      } finally {
        if (alive && generation === getAuthGeneration()) setLoading(false);
      }
    }, 350);
    return () => {
      alive = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [generation, normalized, pageCount, retry]);

  return <>
    <div className="messaging-search">
      <label htmlFor="messaging-search">{t('messaging.search.label')}</label>
      <Input id="messaging-search" name="messaging-search" type="search" autoComplete="off"
        value={query} maxLength={101} prefix={<SearchOutlined aria-hidden />}
        placeholder={t('messaging.search.placeholder')} allowClear
        onChange={(event) => {setQuery(event.target.value); setPageCount(1);}}
        aria-describedby="messaging-search-help" />
      <p id="messaging-search-help">{t('messaging.search.hint')}</p>
    </div>
    {normalized ? <div className="messaging-search-results">
      <div className="messaging-list-status" role="status">
        {normalized.length < 2 ? t('messaging.search.tooShort')
          : loading ? <><Spin size="small" /> {t('messaging.search.loading')}</>
            : !error && results.length === 0 ? t('messaging.search.empty') : null}
      </div>
      {error && <div className="messaging-error" role="alert">{t('messaging.errors.search')} <button type="button" onClick={() => setRetry((value) => value + 1)}>{t('messaging.retry')}</button></div>}
      {results.map((user) => <button type="button" className="messaging-person" key={user.id}
        disabled={opening !== null || !user.is_active} onClick={() => {onOpen(user); setQuery('');}}>
        <UserAvatar user={user} />
        <span className="messaging-person-copy"><strong>{user.display_name || user.username}</strong><small>@{user.username}</small></span>
        {opening === user.id && <Spin size="small" />}
      </button>)}
      {!loading && results.length < total && <button type="button" className="messaging-more" onClick={() => setPageCount((value) => value + 1)}>{t('messaging.search.more')}</button>}
    </div> : children}
  </>;
}
