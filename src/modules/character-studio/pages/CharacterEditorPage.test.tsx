import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {Modal} from 'antd';
import {characterApi} from '../api/characterApi';
import type {StudioCharacter} from '../types/character.types';
import CharacterEditorPage from './CharacterEditorPage';

const mockRefresh = jest.fn();
const mockSetCharacter = jest.fn();
const mockAttachSecondaryJob = jest.fn();
const mockLaunchSecondaryJob = jest.fn().mockResolvedValue('secondary-job');
const mockRetryGenerationJob = jest.fn();
const mockUnsavedChangesGuard = jest.fn();
let mockJobPollingError: string | null = null;
let mockLocationState: Record<string, unknown> | null = null;
const mockSetControls = jest.fn();
const mockSetRegion = jest.fn();

const mockCharacter: StudioCharacter = {
  character_id: 'char-1',
  project_id: 1,
  name: 'Mira',
  age: 17,
  identity_locked: false,
  current_revision_id: 'revision-old',
  images: {},
};

const mockGenerationJob = {
  job_id: 'primary-job',
  status: 'completed',
  progress: 100,
  request_payload: {image_type: 'portrait'},
  variants: [{
    variant_id: 'variant-1',
    image_url: 'https://example.com/variant.png',
    variant_index: 0,
    region: 'face',
    status: 'generated',
  }],
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({t: (key: string) => key}),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({projectId: '1', characterId: 'char-1'}),
  useNavigate: () => jest.fn(),
  useLocation: () => ({state: mockLocationState}),
}));

jest.mock('../hooks/useCharacter', () => ({
  useCharacter: () => ({
    character: mockCharacter,
    refresh: mockRefresh,
    setCharacter: mockSetCharacter,
  }),
}));

jest.mock('../hooks/useCharacterEditor', () => ({
  useCharacterEditor: () => {
    const React = jest.requireActual('react') as typeof import('react');
    const [controls, setControls] = React.useState<Record<string, unknown>>({});
    return {
      controls,
      setControls: (value: Record<string, unknown>) => {
        mockSetControls(value);
        setControls(value);
      },
      setRegion: mockSetRegion,
      textRefinement: '',
      setTextRefinement: jest.fn(),
      request: {
        region: 'face',
        controls,
        preserve: {identity: true},
        variant_count: 1,
      },
    };
  },
}));

jest.mock('../hooks/useGenerationJob', () => ({
  useGenerationJob: (jobId?: string) => ({
    errorMessage: mockJobPollingError,
    job: jobId ? mockGenerationJob : null,
    retry: mockRetryGenerationJob,
  }),
}));

jest.mock('../../../utils/useUnsavedChangesGuard', () => ({
  useUnsavedChangesGuard: (dirty: boolean) => {
    mockUnsavedChangesGuard(dirty);
    return {allowNextNavigation: jest.fn()};
  },
}));

jest.mock('../hooks/useCharacterAssetJobs', () => ({
  dependentImageTypes: () => ['portrait', 'full_body', 'scene'],
  useCharacterAssetJobs: () => ({
    attachJob: mockAttachSecondaryJob,
    jobs: {},
    retry: jest.fn(),
    launchJob: mockLaunchSecondaryJob,
  }),
}));

jest.mock('../components/CharacterEditorLayout', () => ({
  __esModule: true,
  default: ({
    topBar,
    sidebar,
    center,
    right,
  }: {
    topBar: React.ReactNode;
    sidebar: React.ReactNode;
    center: React.ReactNode;
    right: React.ReactNode;
  }) => <>{topBar}{sidebar}{center}{right}</>,
}));

jest.mock('../components/CharacterPreview', () => ({
  __esModule: true,
  default: ({onGenerateImage}: {onGenerateImage: () => void}) => (
    <button onClick={onGenerateImage}>Generate primary</button>
  ),
  viewModeToImageType: () => 'portrait',
}));

jest.mock('../components/VariantGrid', () => ({
  __esModule: true,
  default: ({onApply, variants}: {onApply: (variant: unknown) => void; variants: unknown[]}) => (
    <button onClick={() => onApply(variants[0])}>Apply primary</button>
  ),
}));

jest.mock('../components/CharacterCategorySidebar', () => ({
  __esModule: true,
  default: ({onSelect}: {onSelect: (key: string) => void}) => (
    <>
      <button onClick={() => onSelect('personality')}>Personality tab</button>
      <button onClick={() => onSelect('outfit')}>Outfit tab</button>
    </>
  ),
}));
jest.mock('../components/CharacterSettingsPanel', () => ({
  __esModule: true,
  default: ({
    controls,
    onControlsChange,
  }: {
    controls: Record<string, unknown>;
    onControlsChange: (value: Record<string, unknown>) => void;
  }) => (
    <button onClick={() => onControlsChange({...controls, age: 35})}>
      Edit age
    </button>
  ),
}));
jest.mock('../components/OutfitSettingsPanel', () => ({
  __esModule: true,
  default: ({
    onDescriptionChange,
    onSourceChange,
  }: {
    onDescriptionChange: (value: string) => void;
    onSourceChange: (value: 'reference' | 'text') => void;
  }) => (
    <button onClick={() => {
      onDescriptionChange('Red expedition coat');
      onSourceChange('reference');
    }}>
      Edit outfit
    </button>
  ),
}));
jest.mock('../components/PersonalityEditorPanel', () => ({
  __esModule: true,
  default: ({onChange}: {onChange: (updates: Partial<StudioCharacter>) => void}) => (
    <button onClick={() => onChange({personality: {motivation: 'protect the crew'}})}>
      Edit personality
    </button>
  ),
}));
jest.mock('../events', () => ({
  CHARACTER_DELETED_EVENT: 'character-deleted',
  CHARACTER_RENAMED_EVENT: 'character-renamed',
  notifyCharacterDeleted: jest.fn(),
  notifyCharacterListUpdated: jest.fn(),
  notifyCharacterTreeUpdated: jest.fn(),
}));

jest.mock('../api/characterApi');
jest.mock('../../credits/components/GenerationCostGuard', () => ({
  confirmGenerationCost: () => Promise.resolve({routingMode: 'manual'}),
}));
const mockedApi = characterApi as jest.Mocked<typeof characterApi>;

beforeEach(() => {
  jest.clearAllMocks();
  mockJobPollingError = null;
  mockLocationState = null;
  jest.spyOn(Modal, 'confirm').mockImplementation((config) => {
    void config.onOk?.();
    return {destroy: jest.fn(), update: jest.fn()} as never;
  });
  mockedApi.getGenerationPreview.mockResolvedValue({
    data: {
      provider: 'mock',
      mode: 'offline',
      image_types: ['portrait', 'full_body', 'scene'],
      provider_call_count: 3,
      estimated_cost_usd: '0',
      budgets: {user: {used: 0, limit: 50}, project: {used: 0, limit: 100}},
      concurrency: {global: {active: 0, limit: 4}, project: {active: 0, limit: 2}},
    },
  } as never);
  mockedApi.update.mockImplementation(async (_projectId, _characterId, payload) => ({
    data: {...mockCharacter, ...payload},
  }) as never);
  mockedApi.generateEdit.mockResolvedValue({
    data: {
      ...mockGenerationJob,
      dependent_image_types: ['portrait', 'full_body', 'scene'],
    },
  } as never);
  mockedApi.applyVariant.mockResolvedValue({data: {revision_id: 'revision-applied'}} as never);
  mockedApi.get.mockResolvedValue({
    data: {...mockCharacter, current_revision_id: 'revision-applied'},
  } as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('starts secondary jobs only after Apply, deduplicating Apply double clicks', async () => {
  let completeApply: (() => void) | undefined;
  mockedApi.applyVariant.mockImplementation(() => new Promise((resolve) => {
    completeApply = () => resolve({data: {revision_id: 'revision-applied'}});
  }) as never);
  render(<CharacterEditorPage />);

  fireEvent.click(screen.getByRole('button', {name: 'Generate primary'}));
  await waitFor(() => expect(mockedApi.generateEdit).toHaveBeenCalledTimes(1));
  expect(mockLaunchSecondaryJob).not.toHaveBeenCalled();

  const applyButton = await screen.findByRole('button', {name: 'Apply primary'});
  fireEvent.click(applyButton);
  fireEvent.click(applyButton);
  expect(mockedApi.applyVariant).toHaveBeenCalledTimes(1);
  expect(mockLaunchSecondaryJob).not.toHaveBeenCalled();

  await act(async () => completeApply?.());
  await waitFor(() => {
    expect(mockLaunchSecondaryJob).toHaveBeenCalledTimes(2);
  });
  expect(mockLaunchSecondaryJob).toHaveBeenNthCalledWith(1, 'full_body', 'revision-applied');
  expect(mockLaunchSecondaryJob).toHaveBeenNthCalledWith(2, 'scene', 'revision-applied');
});

it('chains sequential secondary keys from each applied revision', async () => {
  mockedApi.applyVariant
    .mockResolvedValueOnce({data: {revision_id: 'revision-portrait'}} as never)
    .mockResolvedValueOnce({data: {revision_id: 'revision-full-body'}} as never)
    .mockResolvedValueOnce({data: {revision_id: 'revision-scene'}} as never);
  render(<CharacterEditorPage />);

  fireEvent.click(screen.getByRole('button', {name: /Обновить/}));

  await waitFor(() => expect(mockedApi.generateEdit).toHaveBeenCalledTimes(3));
  expect(mockedApi.generateEdit.mock.calls[1][3]).toBe(
    'char-1:full_body:revision-portrait',
  );
  expect(mockedApi.generateEdit.mock.calls[2][3]).toBe(
    'char-1:scene:revision-full-body',
  );
  expect(mockedApi.applyVariant.mock.calls.map((call) => call[5])).toEqual([
    'current_reference',
    null,
    null,
  ]);
});

it('attaches initial full-body and scene jobs passed from portrait selection', async () => {
  mockLocationState = {
    secondaryJobIds: {full_body: 'full-body-job', scene: 'scene-job'},
  };

  render(<CharacterEditorPage />);

  await waitFor(() => {
    expect(mockAttachSecondaryJob).toHaveBeenCalledWith('full_body', 'full-body-job');
    expect(mockAttachSecondaryJob).toHaveBeenCalledWith('scene', 'scene-job');
  });
});

it('sends the updated age and its before/after diff to every regeneration step', async () => {
  render(<CharacterEditorPage />);

  fireEvent.click(screen.getByRole('button', {name: 'Edit age'}));
  fireEvent.click(screen.getByRole('button', {name: /Обновить/}));

  await waitFor(() => expect(mockedApi.generateEdit).toHaveBeenCalledTimes(3));
  expect(mockedApi.update).toHaveBeenCalledWith(
    '1',
    'char-1',
    expect.objectContaining({age: 35}),
  );
  mockedApi.generateEdit.mock.calls.forEach((call) => {
    expect(call[2]).toEqual(expect.objectContaining({
      changed_fields: ['age'],
      previous_values: {age: 17},
      new_values: {age: 35},
      controls: expect.objectContaining({
        age: 35,
        changed_fields: ['age'],
        previous_values: {age: 17},
        new_values: {age: 35},
      }),
    }));
  });
});

it('persists personality and outfit before Generate and clears the saved revision', async () => {
  render(<CharacterEditorPage />);

  fireEvent.click(screen.getByRole('button', {name: 'Personality tab'}));
  fireEvent.click(screen.getByRole('button', {name: 'Edit personality'}));
  fireEvent.click(screen.getByRole('button', {name: 'Outfit tab'}));
  fireEvent.click(screen.getByRole('button', {name: 'Edit outfit'}));
  expect(screen.getByText('Есть изменения')).toBeInTheDocument();
  expect(mockUnsavedChangesGuard).toHaveBeenLastCalledWith(true);

  fireEvent.click(screen.getByRole('button', {name: 'Generate primary'}));

  await waitFor(() => expect(mockedApi.generateEdit).toHaveBeenCalledTimes(1));
  expect(mockedApi.update).toHaveBeenCalledWith(
    '1',
    'char-1',
    expect.objectContaining({
      personality: {motivation: 'protect the crew'},
      clothing_description: 'Red expedition coat',
      clothing_source: 'reference',
    }),
  );
  expect(mockedApi.update.mock.invocationCallOrder[0]).toBeLessThan(
    mockedApi.generateEdit.mock.invocationCallOrder[0],
  );
  await waitFor(() => expect(screen.getByText('Сохранено')).toBeInTheDocument());
});

it('keeps the editor dirty and does not generate when persistence fails', async () => {
  mockedApi.update.mockRejectedValueOnce(new Error('save failed'));
  render(<CharacterEditorPage />);

  fireEvent.click(screen.getByRole('button', {name: 'Personality tab'}));
  fireEvent.click(screen.getByRole('button', {name: 'Edit personality'}));
  fireEvent.click(screen.getByRole('button', {name: 'Outfit tab'}));
  fireEvent.click(screen.getByRole('button', {name: 'Edit outfit'}));
  fireEvent.click(screen.getByRole('button', {name: 'Generate primary'}));

  await waitFor(() => expect(mockedApi.update).toHaveBeenCalledTimes(1));
  expect(mockedApi.generateEdit).not.toHaveBeenCalled();
  expect(screen.getByText('Есть изменения')).toBeInTheDocument();
});

it('does not clear a newer dirty revision when Generate persistence finishes late', async () => {
  let resolveUpdate: (value: unknown) => void = () => undefined;
  mockedApi.update.mockImplementationOnce(() => new Promise((resolve) => {
    resolveUpdate = resolve;
  }) as never);
  render(<CharacterEditorPage />);

  fireEvent.click(screen.getByRole('button', {name: 'Personality tab'}));
  fireEvent.click(screen.getByRole('button', {name: 'Edit personality'}));
  fireEvent.click(screen.getByRole('button', {name: 'Generate primary'}));
  await waitFor(() => expect(mockedApi.update).toHaveBeenCalledTimes(1));

  fireEvent.click(screen.getByRole('button', {name: 'Edit personality'}));
  await act(async () => {
    resolveUpdate({data: {...mockCharacter, personality: {motivation: 'protect the crew'}}});
  });

  await waitFor(() => expect(mockedApi.generateEdit).toHaveBeenCalledTimes(1));
  expect(screen.getByText('Есть изменения')).toBeInTheDocument();
});

it('shows a generation polling error and retries it', () => {
  mockJobPollingError = 'Polling connection failed';

  render(<CharacterEditorPage />);

  expect(screen.getByRole('alert')).toHaveTextContent('Polling connection failed');
  fireEvent.click(screen.getByRole('button', {
    name: '\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c',
  }));
  expect(mockRetryGenerationJob).toHaveBeenCalledTimes(1);
});
