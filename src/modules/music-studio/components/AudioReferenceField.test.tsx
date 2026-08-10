import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import React from 'react';

import i18n from '../../../i18n';
import {musicApi} from '../api/musicApi';
import type {MusicCapabilities, MusicReferenceAsset} from '../types';
import AudioReferenceField from './AudioReferenceField';

const capabilities: MusicCapabilities['audioReference'] = {
  formats: ['mp3', 'wav'],
  maxBytes: 5,
  maxCount: 1,
  maxSeconds: 300,
  minSeconds: 10,
  supported: true,
};

const asset: MusicReferenceAsset = {
  assetId: 'reference-1',
  audioUrl: '/media/reference.mp3',
  audioUrlExpiresAt: null,
  durationSeconds: 42,
  localVerificationStatus: 'accepted',
  mimeType: 'audio/mpeg',
  name: 'reference.mp3',
  providerModerationStatus: 'pending',
};

interface RenderFieldOptions {
  onChange?: jest.Mock;
  value?: MusicReferenceAsset | null;
}

function renderField({onChange = jest.fn(), value = null}: RenderFieldOptions = {}) {
  const view = render(
    <AudioReferenceField
      capabilities={capabilities}
      onAudioPlay={jest.fn()}
      onChange={onChange}
      projectId="7"
      value={value}
    />,
  );
  return {...view, onChange};
}

afterEach(() => {
  jest.restoreAllMocks();
});

test('uploads a valid dropped file immediately', async () => {
  const upload = jest.spyOn(musicApi, 'uploadReference').mockResolvedValue({data: asset} as never);
  const {onChange} = renderField();
  const file = new File(['abc'], 'reference.mp3', {type: 'audio/mpeg'});

  const dropzone = screen.getByRole('button', {
    name: i18n.t('musicStudio.reference.dropzoneLabel'),
  });
  expect(dropzone).toHaveAccessibleDescription(i18n.t('musicStudio.reference.rights'));
  fireEvent.drop(dropzone, {dataTransfer: {files: [file]}});

  await waitFor(() => expect(onChange).toHaveBeenCalledWith(asset));
  expect(upload).toHaveBeenCalledWith('7', file, expect.any(AbortSignal));
  expect(screen.getByText(i18n.t('musicStudio.reference.rights'))).toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.queryByText(i18n.t('musicStudio.reference.private'))).not.toBeInTheDocument();
});

test('opens the file picker from the keyboard', () => {
  renderField();
  const input = screen.getByLabelText(i18n.t('musicStudio.reference.choose'));
  const click = jest.spyOn(input, 'click');

  fireEvent.keyDown(
    screen.getByRole('button', {name: i18n.t('musicStudio.reference.dropzoneLabel')}),
    {key: 'Enter'},
  );

  expect(click).toHaveBeenCalledTimes(1);
});

test('shows client format and size errors without uploading', () => {
  const upload = jest.spyOn(musicApi, 'uploadReference');
  renderField();
  const input = screen.getByLabelText(i18n.t('musicStudio.reference.choose'));

  fireEvent.change(input, {
    target: {files: [new File(['abc'], 'reference.ogg', {type: 'audio/ogg'})]},
  });
  expect(screen.getByText(i18n.t('musicStudio.upload.errors.format', {
    formats: 'MP3, WAV',
  }))).toBeInTheDocument();

  fireEvent.change(input, {
    target: {files: [new File(['123456'], 'reference.mp3', {type: 'audio/mpeg'})]},
  });
  expect(screen.getByText(i18n.t('musicStudio.upload.errors.size', {
    maxSize: i18n.t('musicStudio.upload.size.bytes', {size: 5}),
  }))).toBeInTheDocument();
  expect(upload).not.toHaveBeenCalled();
});

test('keeps the uploaded name and player while omitting provider statuses', async () => {
  const remove = jest.spyOn(musicApi, 'deleteReference').mockResolvedValue({} as never);
  const {onChange} = renderField({value: asset});

  expect(screen.getByText(asset.name)).toBeInTheDocument();
  expect(screen.getByLabelText(i18n.t('musicStudio.player.reference', {
    title: asset.name,
  }))).toBeInTheDocument();
  expect(screen.queryByText(i18n.t(
    `musicStudio.reference.localStatus.${asset.localVerificationStatus}`,
  ))).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', {name: i18n.t('musicStudio.reference.remove')}));

  await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
  expect(remove).toHaveBeenCalledWith('7', asset.assetId);
});

test('aborts an in-flight upload when unmounted', () => {
  let signal: AbortSignal | undefined;
  jest.spyOn(musicApi, 'uploadReference').mockImplementation((projectId, file, nextSignal) => {
    signal = nextSignal;
    return new Promise(() => undefined);
  });
  const {unmount} = renderField();

  fireEvent.change(screen.getByLabelText(i18n.t('musicStudio.reference.choose')), {
    target: {files: [new File(['abc'], 'reference.mp3', {type: 'audio/mpeg'})]},
  });
  unmount();

  expect(signal?.aborted).toBe(true);
});
