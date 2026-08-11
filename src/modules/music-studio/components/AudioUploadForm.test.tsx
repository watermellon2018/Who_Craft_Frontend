import React, {useState} from 'react';
import {fireEvent, render, screen} from '@testing-library/react';

import i18n from '../../../i18n';
import type {MusicCapabilities} from '../types';
import AudioUploadForm from './AudioUploadForm';
import type {AudioUploadDraft} from './AudioUploadForm';

const capabilities: MusicCapabilities['audioReference'] = {
  formats: ['mp3', 'wav'],
  maxBytes: 8,
  maxCount: 1,
  maxSeconds: 300,
  minSeconds: 1,
  supported: true,
};

const emptyDraft: AudioUploadDraft = {
  description: '',
  durationSeconds: null,
  file: null,
  status: 'empty',
  title: '',
};

let pauseSpy: jest.SpyInstance;

function ControlledUpload({
  onEdit,
  showDraft = false,
  uploadCapabilities = capabilities,
}: {
  onEdit?: () => void;
  showDraft?: boolean;
  uploadCapabilities?: MusicCapabilities['audioReference'];
}) {
  const [draft, setDraft] = useState(emptyDraft);
  return (
    <>
      <AudioUploadForm
        capabilities={uploadCapabilities}
        onAudioPlay={jest.fn()}
        onChange={setDraft}
        onEdit={onEdit}
        value={draft}
      />
      {showDraft && (
        <output data-testid="upload-draft">
          {JSON.stringify({
            description: draft.description,
            durationSeconds: draft.durationSeconds,
            fileName: draft.file?.name ?? null,
            status: draft.status,
            title: draft.title,
          })}
        </output>
      )}
    </>
  );
}

function PersistedTabs() {
  const [activeTab, setActiveTab] = useState<'details' | 'upload'>('upload');
  const [draft, setDraft] = useState(emptyDraft);
  return (
    <>
      <button type="button" onClick={() => setActiveTab('upload')}>upload tab</button>
      <button type="button" onClick={() => setActiveTab('details')}>details tab</button>
      {activeTab === 'upload' && (
        <AudioUploadForm
          capabilities={capabilities}
          onAudioPlay={jest.fn()}
          onChange={setDraft}
          value={draft}
        />
      )}
    </>
  );
}

function getFileInput(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>('.music-upload__input');
  if (!input) throw new Error('Audio file input is missing');
  return input;
}

beforeEach(() => {
  pauseSpy = jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: jest.fn(() => 'blob:audio-upload-preview'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: jest.fn(),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('shows title and description fields before the file upload area', () => {
  render(<ControlledUpload />);

  const title = screen.getByPlaceholderText(i18n.t('musicStudio.upload.titlePlaceholder'));
  const description = screen.getByPlaceholderText(
    i18n.t('musicStudio.upload.descriptionPlaceholder'),
  );
  const dropzone = screen.getByRole('button', {
    name: i18n.t('musicStudio.upload.dropzoneLabel'),
  });

  expect(title.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(description.compareDocumentPosition(dropzone) & Node.DOCUMENT_POSITION_FOLLOWING)
    .toBeTruthy();
});

test('rejects files whose extension is not listed in the capabilities', () => {
  const {container} = render(<ControlledUpload />);

  fireEvent.change(getFileInput(container), {
    target: {files: [new File(['audio'], 'theme.ogg', {type: 'audio/ogg'})]},
  });

  expect(screen.getByRole('alert')).toHaveTextContent(
    i18n.t('musicStudio.upload.errors.format', {formats: 'MP3, WAV'}),
  );
  expect(screen.queryByText('theme.ogg')).not.toBeInTheDocument();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test('rejects files larger than the advertised limit', () => {
  const {container} = render(<ControlledUpload />);

  fireEvent.change(getFileInput(container), {
    target: {files: [new File(['too-large'], 'theme.mp3', {type: 'audio/mpeg'})]},
  });

  expect(screen.getByRole('alert')).toHaveTextContent(
    i18n.t('musicStudio.upload.errors.size', {
      maxSize: i18n.t('musicStudio.upload.size.bytes', {size: capabilities.maxBytes}),
    }),
  );
  expect(screen.queryByText('theme.mp3')).not.toBeInTheDocument();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test('keeps local upload available when AI audio references are unsupported', () => {
  const {container} = render(
    <ControlledUpload uploadCapabilities={{...capabilities, supported: false}} />,
  );

  fireEvent.change(getFileInput(container), {
    target: {files: [new File(['music'], 'theme.mp3', {type: 'audio/mpeg'})]},
  });

  expect(screen.getByText('theme.mp3')).toBeInTheDocument();
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
});

test('selects, previews and removes a file while preserving its text metadata', () => {
  const {container} = render(<ControlledUpload showDraft />);
  const file = new File(['music'], 'theme.mp3', {type: 'audio/mpeg'});

  fireEvent.change(getFileInput(container), {target: {files: [file]}});
  fireEvent.change(screen.getByPlaceholderText(i18n.t('musicStudio.upload.titlePlaceholder')), {
    target: {value: 'Opening theme'},
  });
  fireEvent.change(screen.getByPlaceholderText(
    i18n.t('musicStudio.upload.descriptionPlaceholder'),
  ), {target: {value: 'Ready mix'}});

  expect(screen.getByText('theme.mp3')).toBeInTheDocument();
  const audio = screen.getByLabelText(i18n.t('musicStudio.upload.previewLabel'));
  Object.defineProperty(audio, 'duration', {configurable: true, value: 65.4});
  fireEvent.loadedMetadata(audio);
  expect(screen.getByText('1:05')).toBeInTheDocument();
  expect(JSON.parse(screen.getByTestId('upload-draft').textContent ?? '')).toEqual({
    description: 'Ready mix',
    durationSeconds: 65.4,
    fileName: 'theme.mp3',
    status: 'ready',
    title: 'Opening theme',
  });

  fireEvent.click(screen.getByRole('button', {name: i18n.t('musicStudio.upload.remove')}));

  expect(screen.queryByText('theme.mp3')).not.toBeInTheDocument();
  expect(screen.getByPlaceholderText(i18n.t('musicStudio.upload.titlePlaceholder')))
    .toHaveValue('Opening theme');
  expect(screen.getByPlaceholderText(i18n.t('musicStudio.upload.descriptionPlaceholder')))
    .toHaveValue('Ready mix');
  expect(JSON.parse(screen.getByTestId('upload-draft').textContent ?? '')).toEqual({
    description: 'Ready mix',
    durationSeconds: null,
    fileName: null,
    status: 'empty',
    title: 'Opening theme',
  });
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:audio-upload-preview');
});

test('offers editing only after the selected file passes local validation', () => {
  const onEdit = jest.fn();
  const {container} = render(<ControlledUpload onEdit={onEdit} />);

  expect(screen.queryByRole('button', {
    name: i18n.t('musicStudio.upload.edit', {name: 'theme.mp3'}),
  })).not.toBeInTheDocument();

  fireEvent.change(getFileInput(container), {
    target: {files: [new File(['music'], 'theme.mp3', {type: 'audio/mpeg'})]},
  });

  expect(screen.getByRole('button', {
    name: i18n.t('musicStudio.upload.editPreparing'),
  })).toBeDisabled();

  const audio = screen.getByLabelText(i18n.t('musicStudio.upload.previewLabel'));
  Object.defineProperty(audio, 'duration', {configurable: true, value: 65.4});
  fireEvent.loadedMetadata(audio);

  const editButton = screen.getByRole('button', {
    name: i18n.t('musicStudio.upload.editAria', {name: 'theme.mp3'}),
  });
  expect(editButton).toBeEnabled();
  fireEvent.click(editButton);
  expect(onEdit).toHaveBeenCalledTimes(1);
});

test('rejects an audio duration outside the advertised limits', () => {
  const {container} = render(<ControlledUpload showDraft />);

  fireEvent.change(getFileInput(container), {
    target: {files: [new File(['music'], 'theme.mp3', {type: 'audio/mpeg'})]},
  });
  const audio = screen.getByLabelText(i18n.t('musicStudio.upload.previewLabel'));
  Object.defineProperty(audio, 'duration', {configurable: true, value: 301});
  fireEvent.loadedMetadata(audio);

  expect(screen.getByRole('alert')).toHaveTextContent(
    i18n.t('musicStudio.upload.errors.duration', {
      max: capabilities.maxSeconds,
      min: capabilities.minSeconds,
    }),
  );
  expect(JSON.parse(screen.getByTestId('upload-draft').textContent ?? ''))
    .toMatchObject({durationSeconds: null, fileName: 'theme.mp3', status: 'invalid'});
});

test('reports an unreadable audio file instead of marking it ready', () => {
  const {container} = render(<ControlledUpload showDraft />);

  fireEvent.change(getFileInput(container), {
    target: {files: [new File(['music'], 'broken.mp3', {type: 'audio/mpeg'})]},
  });
  fireEvent.error(screen.getByLabelText(i18n.t('musicStudio.upload.previewLabel')));

  expect(screen.getByRole('alert')).toHaveTextContent(
    i18n.t('musicStudio.upload.errors.metadata'),
  );
  expect(JSON.parse(screen.getByTestId('upload-draft').textContent ?? ''))
    .toMatchObject({durationSeconds: null, fileName: 'broken.mp3', status: 'invalid'});
});

test('stops the local preview when its file is removed', () => {
  const {container} = render(<ControlledUpload />);

  fireEvent.change(getFileInput(container), {
    target: {files: [new File(['music'], 'theme.mp3', {type: 'audio/mpeg'})]},
  });
  fireEvent.click(screen.getByRole('button', {name: i18n.t('musicStudio.upload.remove')}));

  expect(pauseSpy).toHaveBeenCalled();
});

test('restores the parent-owned draft after the upload tab is remounted', () => {
  const {container} = render(<PersistedTabs />);
  const file = new File(['music'], 'theme.wav', {type: 'audio/wav'});

  fireEvent.drop(screen.getByRole('button', {
    name: i18n.t('musicStudio.upload.dropzoneLabel'),
  }), {dataTransfer: {files: [file]}});
  fireEvent.change(screen.getByPlaceholderText(i18n.t('musicStudio.upload.titlePlaceholder')), {
    target: {value: 'Main title'},
  });
  fireEvent.change(screen.getByPlaceholderText(
    i18n.t('musicStudio.upload.descriptionPlaceholder'),
  ), {target: {value: 'Final master'}});

  fireEvent.click(screen.getByRole('button', {name: 'details tab'}));
  expect(container.querySelector('.music-upload')).not.toBeInTheDocument();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:audio-upload-preview');

  fireEvent.click(screen.getByRole('button', {name: 'upload tab'}));
  expect(screen.getByText('theme.wav')).toBeInTheDocument();
  expect(screen.getByPlaceholderText(i18n.t('musicStudio.upload.titlePlaceholder')))
    .toHaveValue('Main title');
  expect(screen.getByPlaceholderText(i18n.t('musicStudio.upload.descriptionPlaceholder')))
    .toHaveValue('Final master');
});
