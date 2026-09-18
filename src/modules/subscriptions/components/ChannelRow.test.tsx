import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import i18n from '../../../i18n';
import ChannelRow from './ChannelRow';
import { Channel } from '../types';

function makeChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: 7,
    name: 'Vasiliy Andreev',
    username: 'vasiliy',
    subscribers: '1.2K',
    avatarUrl: null,
    avatarFallback: 'VA',
    isSubscribed: false,
    notificationsEnabled: true,
    isFavorite: false,
    ...overrides,
  };
}

describe('ChannelRow', () => {
  it('renders name, @username and subscribers count', () => {
    render(
      <ChannelRow
        channel={makeChannel()}
        isDropdownOpen={false}
        onToggleDropdown={jest.fn()}
        onSubscribe={jest.fn()}
        onUnsubscribe={jest.fn()}
      />,
    );

    expect(screen.getByText('Vasiliy Andreev')).toBeInTheDocument();
    expect(screen.getByText('@vasiliy')).toBeInTheDocument();
    expect(screen.getByText('1.2K')).toBeInTheDocument();
  });

  it('renders avatar fallback initials when avatarUrl is empty', () => {
    render(
      <ChannelRow
        channel={makeChannel({ avatarUrl: null })}
        isDropdownOpen={false}
        onToggleDropdown={jest.fn()}
        onSubscribe={jest.fn()}
        onUnsubscribe={jest.fn()}
      />,
    );
    expect(screen.getByText('VA')).toBeInTheDocument();
  });

  it('renders <img> when avatarUrl is present', () => {
    render(
      <ChannelRow
        channel={makeChannel({ avatarUrl: 'http://example.com/a.png' })}
        isDropdownOpen={false}
        onToggleDropdown={jest.fn()}
        onSubscribe={jest.fn()}
        onUnsubscribe={jest.fn()}
      />,
    );
    const img = screen.getByAltText('Vasiliy Andreev') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toContain('http://example.com/a.png');
  });

  it('shows "Подписаться" button and triggers onSubscribe when not subscribed', () => {
    const onSubscribe = jest.fn();
    render(
      <ChannelRow
        channel={makeChannel({ isSubscribed: false })}
        isDropdownOpen={false}
        onToggleDropdown={jest.fn()}
        onSubscribe={onSubscribe}
        onUnsubscribe={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Подписаться'));
    expect(onSubscribe).toHaveBeenCalledWith(7);
  });

  it('shows "Подписан" button (no unsubscribe yet) when subscribed and dropdown closed', () => {
    const onToggleDropdown = jest.fn();
    render(
      <ChannelRow
        channel={makeChannel({ isSubscribed: true })}
        isDropdownOpen={false}
        onToggleDropdown={onToggleDropdown}
        onSubscribe={jest.fn()}
        onUnsubscribe={jest.fn()}
      />,
    );

    expect(screen.getByText('Подписан')).toBeInTheDocument();
    expect(screen.queryByText('Отписаться')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Подписан'));
    expect(onToggleDropdown).toHaveBeenCalledWith(7);
  });

  it('renders unsubscribe entry when dropdown is open and triggers onUnsubscribe', () => {
    const onUnsubscribe = jest.fn();
    render(
      <ChannelRow
        channel={makeChannel({ isSubscribed: true })}
        isDropdownOpen={true}
        onToggleDropdown={jest.fn()}
        onSubscribe={jest.fn()}
        onUnsubscribe={onUnsubscribe}
      />,
    );

    const unsubscribeBtn = screen.getByText('Отписаться');
    fireEvent.click(unsubscribeBtn);
    expect(onUnsubscribe).toHaveBeenCalledWith(7);
  });

  it('renders subscription actions in English when English is selected', async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });

    render(
      <ChannelRow
        channel={makeChannel({isSubscribed: false})}
        isDropdownOpen={false}
        onToggleDropdown={jest.fn()}
        onSubscribe={jest.fn()}
        onUnsubscribe={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', {name: 'Subscribe'})).toBeInTheDocument();
    expect(screen.getByText('subscribers')).toBeInTheDocument();

    await act(async () => {
      await i18n.changeLanguage('ru');
    });
  });
});
