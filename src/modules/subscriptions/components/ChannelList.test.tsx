import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChannelList from './ChannelList';
import { Channel } from '../types';

function makeChannel(id: number, name: string): Channel {
  return {
    id,
    name,
    username: name.toLowerCase(),
    subscribers: '1K',
    avatarUrl: null,
    avatarFallback: name.slice(0, 2).toUpperCase(),
    isSubscribed: false,
    notificationsEnabled: true,
    isFavorite: false,
  };
}

const baseProps = {
  channels: [] as Channel[],
  title: 'Мои подписки',
  shown: 0,
  total: 0,
  isSearchMode: false,
  searchQuery: '',
  onSubscribe: jest.fn(),
  onUnsubscribe: jest.fn(),
  onShowMore: jest.fn(),
};

describe('ChannelList', () => {
  it('renders the title', () => {
    render(<ChannelList {...baseProps} />);
    expect(screen.getByText('Мои подписки')).toBeInTheDocument();
  });

  it('renders empty state when there are no channels', () => {
    render(
      <ChannelList
        {...baseProps}
        channels={[]}
        isSearchMode={true}
        searchQuery="foo"
      />,
    );
    expect(screen.getByText('Каналы не найдены')).toBeInTheDocument();
    expect(
      screen.getByText(/По запросу «foo» ничего не найдено/),
    ).toBeInTheDocument();
  });

  it('renders a loading indicator when isLoading and no channels', () => {
    render(
      <ChannelList
        {...baseProps}
        channels={[]}
        isLoading={true}
      />,
    );
    expect(screen.getByText('Загрузка...')).toBeInTheDocument();
  });

  it('renders a row per channel', () => {
    const channels = [makeChannel(1, 'Alice'), makeChannel(2, 'Bob')];
    render(
      <ChannelList
        {...baseProps}
        channels={channels}
        shown={2}
        total={2}
      />,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders badge when provided', () => {
    render(
      <ChannelList
        {...baseProps}
        channels={[makeChannel(1, 'Alice')]}
        shown={1}
        total={1}
        badge={5}
      />,
    );
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows "Показать ещё" only when shown < total and triggers onShowMore', () => {
    const onShowMore = jest.fn();
    render(
      <ChannelList
        {...baseProps}
        channels={[makeChannel(1, 'Alice')]}
        shown={1}
        total={10}
        onShowMore={onShowMore}
      />,
    );
    const showMore = screen.getByText('Показать ещё');
    fireEvent.click(showMore);
    expect(onShowMore).toHaveBeenCalled();
  });

  it('does not show "Показать ещё" when shown >= total', () => {
    render(
      <ChannelList
        {...baseProps}
        channels={[makeChannel(1, 'Alice')]}
        shown={1}
        total={1}
      />,
    );
    expect(screen.queryByText('Показать ещё')).not.toBeInTheDocument();
  });
});
