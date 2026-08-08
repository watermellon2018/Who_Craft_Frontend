import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';

import i18n from '../../../i18n';
import type {MusicVariant} from '../types';
import MusicVariantPlayer from './MusicVariantPlayer';

const variant: MusicVariant = {
  appliedTrackVersionId: null,
  audioUrl: '/media/variant-a.mp3',
  audioUrlExpiresAt: '2026-08-02T12:00:00Z',
  durationSeconds: 42,
  index: 0,
  mimeType: 'audio/mpeg',
  seed: 17,
  status: 'generated',
  variantId: 'variant-a',
};

const renderPlayer = (currentVariant: MusicVariant, onSignedUrlExpired = jest.fn()) => ({
  onSignedUrlExpired,
  ...render(
    <MusicVariantPlayer
      variant={currentVariant}
      onApply={jest.fn()}
      onAudioPlay={jest.fn()}
      onSignedUrlExpired={onSignedUrlExpired}
    />,
  ),
});

test('requests one refresh per variant even when its signed URL changes', () => {
  const {onSignedUrlExpired, rerender} = renderPlayer(variant);
  const label = i18n.t('musicStudio.player.variant', {letter: 'A'});

  fireEvent.error(screen.getByLabelText(label));
  fireEvent.error(screen.getByLabelText(label));
  expect(onSignedUrlExpired).toHaveBeenCalledTimes(1);

  rerender(
    <MusicVariantPlayer
      variant={{...variant, audioUrl: '/media/variant-a-renewed.mp3'}}
      onApply={jest.fn()}
      onAudioPlay={jest.fn()}
      onSignedUrlExpired={onSignedUrlExpired}
    />,
  );
  fireEvent.error(screen.getByLabelText(label));
  expect(onSignedUrlExpired).toHaveBeenCalledTimes(1);

  rerender(
    <MusicVariantPlayer
      variant={{...variant, audioUrl: '/media/variant-b.mp3', variantId: 'variant-b'}}
      onApply={jest.fn()}
      onAudioPlay={jest.fn()}
      onSignedUrlExpired={onSignedUrlExpired}
    />,
  );
  fireEvent.error(screen.getByLabelText(label));
  expect(onSignedUrlExpired).toHaveBeenCalledTimes(2);
});

test('does not render an audio element when the variant has no playable URL', () => {
  renderPlayer({...variant, audioUrl: null} as MusicVariant);

  expect(screen.queryByLabelText(
    i18n.t('musicStudio.player.variant', {letter: 'A'}),
  )).not.toBeInTheDocument();
  expect(screen.getByText(i18n.t('musicStudio.player.unavailable'))).toBeInTheDocument();
});
