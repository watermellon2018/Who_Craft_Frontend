import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';
import {characterApi} from '../api/characterApi';
import CharacterVariantsPage from './CharacterVariantsPage';

jest.mock('../api/characterApi');
jest.mock('../../credits/components/GenerationCostGuard', () => ({
  GenerationCostPreview: () => null,
  runGenerationWithCredits: (
    intent: {modelKey?: string},
    operation: (estimate: unknown) => unknown,
  ) => operation({modelKey: intent.modelKey ?? 'gemini-flash-image', routingMode: 'manual'}),
}));
jest.mock('../hooks/useGenerationJob', () => ({
  useGenerationJob: jest.fn(),
}));
jest.mock('../api/treeApi', () => ({
  characterTreeApi: {
    create: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../events', () => ({
  notifyCharacterListUpdated: jest.fn(),
  notifyCharacterTreeUpdated: jest.fn(),
}));

import {characterTreeApi} from '../api/treeApi';
import {useGenerationJob} from '../hooks/useGenerationJob';

const mockedApi = characterApi as jest.Mocked<typeof characterApi>;
const mockedCreateTreeNode = characterTreeApi.create as jest.MockedFunction<typeof characterTreeApi.create>;
const mockedUseGenerationJob = useGenerationJob as jest.MockedFunction<typeof useGenerationJob>;

const PROJECT_ID = 'proj-1';
const CHARACTER_ID = 'char-1';

const VARIANTS = [
  {variant_id: 'v1', image_url: 'http://img/1.png', variant_index: 0, region: 'face', status: 'generated' as const},
  {variant_id: 'v2', image_url: 'http://img/2.png', variant_index: 1, region: 'face', status: 'generated' as const},
];

const NEW_VARIANTS = [
  {variant_id: 'v3', image_url: 'http://img/3.png', variant_index: 0, region: 'face', status: 'generated' as const},
  {variant_id: 'v4', image_url: 'http://img/4.png', variant_index: 1, region: 'face', status: 'generated' as const},
];

const PAGE_STATE = {
  jobId: 'job-1',
  formValues: {
    visual_style: 'cinematic_realism',
    appearance_description: 'A warrior',
    character_type: 'human',
    age: 30,
  },
  characterId: CHARACTER_ID,
  characterName: 'Hero',
  sourceTreeNodeId: 'tree-1',
  generationOptions: {
    count: 2 as const,
    creativity: 'balanced' as const,
    imageModel: 'openrouter-images:openai/gpt-image-1',
    lockSeed: false,
    seed: '',
  },
};

function CreatePageProbe() {
  const location = useLocation();
  return <><div>Create page</div><pre>{JSON.stringify({path: `${location.pathname}${location.search}`, state: location.state})}</pre></>;
}

function EditPageProbe() {
  const location = useLocation();
  return <><div>Edit page</div><pre>{JSON.stringify(location.state)}</pre></>;
}

function renderPage(
  locationState: Partial<typeof PAGE_STATE> & Record<string, unknown> = PAGE_STATE,
  jobId: string | null = PAGE_STATE.jobId,
  treeNodeId: string | null = PAGE_STATE.sourceTreeNodeId,
) {
  const query = new URLSearchParams();
  if (jobId) query.set('jobId', jobId);
  if (treeNodeId) query.set('treeNodeId', treeNodeId);
  const search = query.toString() ? `?${query.toString()}` : '';
  return render(
    <MemoryRouter
      initialEntries={[{pathname: `/project/${PROJECT_ID}/characters/${CHARACTER_ID}/variants`, search, state: locationState}]}
    >
      <Routes>
        <Route
          path="/project/:projectId/characters/:characterId/variants"
          element={<CharacterVariantsPage />}
        />
        <Route path="/project/:projectId/characters/create" element={<CreatePageProbe />} />
        <Route path="/project/:projectId/characters/:characterId/edit" element={<EditPageProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.applyVariant.mockResolvedValue({data: {revision_id: 'revision-1'}} as never);
  mockedApi.get.mockResolvedValue({data: {
    character_id: CHARACTER_ID,
    project_id: 1,
    name: 'Hero',
    character_type: 'human',
    role: 'main',
    gender: 'female',
    short_description: 'Recovered summary',
    personality: {description: 'Recovered personality'},
    backstory: 'Recovered backstory',
    identity_locked: false,
    appearance: {appearance_prompt: 'Recovered hero'},
  }} as never);
  mockedCreateTreeNode.mockResolvedValue({
    id: 'tree-1',
    key: 'tree-1',
    name: 'Hero',
    is_folder: false,
    character_id: CHARACTER_ID,
  });
  mockedApi.generateInitial.mockResolvedValue({
    data: {job_id: 'job-regen', status: 'queued', progress: 0, variants: []},
  } as never);
  mockedApi.generateEdit.mockImplementation(async (_projectId, _characterId, payload) => ({
    data: {
      job_id: payload.image_type === 'full_body' ? 'full-body-job' : 'scene-job',
      status: 'queued',
    },
  }) as never);
  mockedApi.listGenerationJobs.mockResolvedValue({data: {jobs: []}} as never);
  mockedApi.requestGenerationJobCancellation.mockResolvedValue({
    data: {job_id: 'job-1', status: 'cancellation_requested', progress: 40, variants: []},
  } as never);
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('CharacterVariantsPage – initial state', () => {
  it('shows loading state while job is processing', () => {
    mockedUseGenerationJob.mockReturnValue({job: {job_id: 'job-1', status: 'processing', progress: 40, variants: []}} as never);
    renderPage();
    expect(screen.getByText(/генерируем портретные варианты/i)).toBeInTheDocument();
  });


  it('allows cancellation from the initial loading state', async () => {
    mockedUseGenerationJob.mockReturnValue({
      job: {job_id: 'job-1', status: 'processing', progress: 40, variants: []},
      loading: false,
    } as never);

    renderPage();
    fireEvent.click(await screen.findByRole('button', {name: 'Запросить отмену'}));

    await waitFor(() => expect(mockedApi.requestGenerationJobCancellation).toHaveBeenCalledWith('job-1'));
  });
  it('displays variant cards when job is completed', () => {
    mockedUseGenerationJob.mockReturnValue({
      job: {job_id: 'job-1', status: 'completed', progress: 100, variants: VARIANTS},
    } as never);
    renderPage();
    expect(screen.getByRole('img', {name: 'Вариант 1'})).toBeInTheDocument();
    expect(screen.getByRole('img', {name: 'Вариант 2'})).toBeInTheDocument();
  });

  it('recovers variants and generation parameters from the URL and job after refresh', async () => {
    mockedUseGenerationJob.mockReturnValue({
      job: {
        job_id: 'job-1',
        character_id: CHARACTER_ID,
        status: 'completed',
        progress: 100,
        variants: VARIANTS,
        request_payload: {
          variant_count: 2,
          creativity: 'balanced',
          image_model: 'openrouter-images:black-forest-labs/flux.2-pro',
          visual_style: 'cinematic_realism',
          appearance_description: 'Recovered hero',
          character_type: 'human',
        },
      },
      loading: false,
      errorStatus: null,
      errorMessage: null,
    } as never);

    renderPage({generationOptions: PAGE_STATE.generationOptions} as never);

    expect(screen.getByRole('img', {name: 'Вариант 1'})).toBeInTheDocument();
    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith(PROJECT_ID, CHARACTER_ID));
    fireEvent.click(screen.getByRole('button', {name: /перегенерировать/i}));
    await waitFor(() => expect(mockedApi.generateInitial).toHaveBeenCalledTimes(1));
    expect(mockedApi.generateInitial.mock.calls[0][2]).toEqual(expect.objectContaining({
      appearance_description: 'Recovered hero',
      image_model: 'openrouter-images:black-forest-labs/flux.2-pro',
      variant_count: 2,
    }));
  });

  it('recovers the full saved form and tree context before editing after refresh', async () => {
    mockedUseGenerationJob.mockReturnValue({
      job: {
        job_id: 'job-1',
        character_id: CHARACTER_ID,
        status: 'completed',
        progress: 100,
        variants: VARIANTS,
        request_payload: {
          variant_count: 2,
          appearance_description: 'Recovered hero',
          image_model: 'openrouter-images:google/gemini-2.5-flash-image',
        },
      },
      loading: false,
      errorStatus: null,
      errorMessage: null,
    } as never);

    renderPage({generationOptions: PAGE_STATE.generationOptions} as never, 'job-1', 'tree-1');
    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith(PROJECT_ID, CHARACTER_ID));
    await waitFor(() => expect(screen.getByRole('button', {name: /изменить параметры/i})).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', {name: /изменить параметры/i}));

    expect(screen.getByText('Create page')).toBeInTheDocument();
    expect(screen.getByText(/draftId=char-1&treeNodeId=tree-1/)).toBeInTheDocument();
    expect(screen.getByText(/"role":"main"/)).toBeInTheDocument();
    expect(screen.getByText(/"gender":"female"/)).toBeInTheDocument();
    expect(screen.getByText(/"personality_description":"Recovered personality"/)).toBeInTheDocument();
    expect(screen.getByText(/"imageModel":"openrouter-images:google\/gemini-2.5-flash-image"/)).toBeInTheDocument();
  });

  it('uses the URL tree node when Apply follows a refresh', async () => {
    mockedUseGenerationJob.mockReturnValue({
      job: {job_id: 'job-1', character_id: CHARACTER_ID, status: 'completed', progress: 100, variants: VARIANTS},
      loading: false,
      errorStatus: null,
      errorMessage: null,
    } as never);

    renderPage({} as never, 'job-1', 'tree-1');
    await waitFor(() => expect(screen.getByRole('button', {name: /продолжить/i})).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', {name: /продолжить/i}));

    await waitFor(() => expect(mockedCreateTreeNode).toHaveBeenCalled());
    expect(mockedCreateTreeNode).toHaveBeenCalledWith(PROJECT_ID, {
      id: 'tree-1',
      name: 'Hero',
      type: 'character',
      studio_character_id: CHARACTER_ID,
    });
  });

  it('shows an explicit forbidden error returned by the job endpoint', () => {
    mockedUseGenerationJob.mockReturnValue({
      job: null,
      loading: false,
      errorStatus: 403,
      errorMessage: 'Нет доступа к заданию генерации',
      isActive: false,
      retry: jest.fn(),
      isTerminal: false,
    });
    renderPage({} as never);
    expect(screen.getByText('Нет доступа к генерации')).toBeInTheDocument();
    expect(screen.getByText('Нет доступа к заданию генерации')).toBeInTheDocument();
  });

  it('retries a failed job poll from the visible error state', () => {
    const retry = jest.fn();
    mockedUseGenerationJob.mockReturnValue({
      job: null,
      loading: false,
      errorStatus: null,
      errorMessage: 'Polling connection failed',
      retry,
      isActive: false,
      isTerminal: false,
    });

    renderPage({} as never);

    expect(screen.getByText('Polling connection failed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {
      name: '\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c',
    }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('shows error state on job failure', () => {
    mockedUseGenerationJob.mockReturnValue({
      job: {job_id: 'job-1', status: 'failed', progress: 0, variants: [], error_message: 'Что-то пошло не так'},
    } as never);
    renderPage();
    expect(screen.getByText(/ошибка генерации/i)).toBeInTheDocument();
    expect(screen.getAllByText('Что-то пошло не так')).not.toHaveLength(0);
  });

  it('shows "no context" error when navigated to without state', () => {
    mockedUseGenerationJob.mockReturnValue({job: null} as never);
    renderPage({} as never, null);
    expect(screen.getByText(/сессия не найдена/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Regenerate button — key behaviour
// ---------------------------------------------------------------------------

describe('CharacterVariantsPage – Regenerate button', () => {
  beforeEach(() => {
    mockedUseGenerationJob.mockReturnValue({
      job: {job_id: 'job-1', status: 'completed', progress: 100, variants: VARIANTS},
    } as never);
  });

  it('does NOT navigate away when Regenerate is clicked', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', {name: /перегенерировать/i}));
    await act(async () => { await Promise.resolve(); });
    // Create page text should NOT be visible
    expect(screen.queryByText('Create page')).not.toBeInTheDocument();
  });

  it('calls generateInitial with the stored form params (no navigation)', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', {name: /перегенерировать/i}));
    await act(async () => { await Promise.resolve(); });

    expect(mockedApi.generateInitial).toHaveBeenCalledTimes(1);
    const [calledProject, calledCharacter, payload] = mockedApi.generateInitial.mock.calls[0];
    expect(calledProject).toBe(PROJECT_ID);
    expect(calledCharacter).toBe(CHARACTER_ID);
    expect((payload as Record<string, unknown>).visual_style).toBe('cinematic_realism');
    expect((payload as Record<string, unknown>).appearance_description).toBe('A warrior');
    expect((payload as Record<string, unknown>).image_type).toBe('portrait');
    expect((payload as Record<string, unknown>).image_model).toBe('openrouter-images:openai/gpt-image-1');
    expect((payload as Record<string, unknown>).variant_count).toBe(2);
  });

  it('disables the Regenerate button while generating', () => {
    mockedApi.generateInitial.mockImplementation(() => new Promise(() => {}) as never);
    renderPage();
    fireEvent.click(screen.getByRole('button', {name: /перегенерировать/i}));
    // Before the API promise resolves the button should be disabled
    const btn = screen.getByRole('button', {name: /генерируем/i});
    expect(btn).toBeDisabled();
  });

  it('shows skeleton cards during regeneration', async () => {
    // First call: job for the new regen is still queued
    mockedUseGenerationJob.mockImplementation((jobId) => {
      if (jobId === 'job-regen') {
        return {job: {job_id: 'job-regen', status: 'queued', progress: 0, variants: []}} as never;
      }
      return {job: {job_id: 'job-1', status: 'completed', progress: 100, variants: VARIANTS}} as never;
    });

    const {container} = renderPage();
    fireEvent.click(screen.getByRole('button', {name: /перегенерировать/i}));

    await waitFor(() => {
      expect(container.querySelectorAll('.cvp-card--skeleton')).toHaveLength(PAGE_STATE.generationOptions.count);
    });
    expect(container.querySelectorAll('.cvp-grid img')).toHaveLength(0);
  });

  it('replaces old variants with new ones after regen completes', async () => {
    mockedUseGenerationJob
      .mockReturnValueOnce({job: {job_id: 'job-1', status: 'completed', progress: 100, variants: VARIANTS}} as never)
      .mockReturnValue({job: {job_id: 'job-regen', status: 'completed', progress: 100, variants: NEW_VARIANTS}} as never);

    renderPage();
    // Initial variants visible
    expect(screen.getByRole('img', {name: 'Вариант 1'})).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: /перегенерировать/i}));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // New variants should now be visible
    await waitFor(() => {
      expect(screen.getByRole('img', {name: 'Вариант 1'})).toBeInTheDocument();
      expect(screen.getByRole('img', {name: 'Вариант 2'})).toBeInTheDocument();
    });
    // Old image URLs replaced with new ones
    const imgs = screen.getAllByRole('img') as HTMLImageElement[];
    const srcs = imgs.map(i => i.src);
    expect(srcs).toContain('http://img/3.png');
    expect(srcs).not.toContain('http://img/1.png');
  });

  it('shows an inline error and re-enables button when generateInitial fails', async () => {
    mockedApi.generateInitial.mockRejectedValue(new Error('Network error'));

    renderPage();
    fireEvent.click(screen.getByRole('button', {name: /перегенерировать/i}));
    await act(async () => { await Promise.resolve(); });

    await waitFor(() => {
      expect(screen.getByText(/ошибка при запуске генерации/i)).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /перегенерировать/i})).not.toBeDisabled();
    });
  });

  it('prevents double-click (button disabled while regenerating)', async () => {
    renderPage();
    const btn = screen.getByRole('button', {name: /перегенерировать/i});
    fireEvent.click(btn);
    // While in flight, second click should be ignored
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', {name: /генерируем/i}));
    await act(async () => { await Promise.resolve(); });
    expect(mockedApi.generateInitial).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// "Изменить параметры" (Change params) — must still navigate
// ---------------------------------------------------------------------------

describe('CharacterVariantsPage – Change Params button', () => {
  it('navigates to the create page when Change Params is clicked', () => {
    mockedUseGenerationJob.mockReturnValue({
      job: {job_id: 'job-1', status: 'completed', progress: 100, variants: VARIANTS},
    } as never);
    renderPage();
    fireEvent.click(screen.getByRole('button', {name: /изменить параметры/i}));
    expect(screen.getByText('Create page')).toBeInTheDocument();
  });

  it('does NOT navigate when Regenerate is clicked', async () => {
    mockedUseGenerationJob.mockReturnValue({
      job: {job_id: 'job-1', status: 'completed', progress: 100, variants: VARIANTS},
    } as never);
    renderPage();
    fireEvent.click(screen.getByRole('button', {name: /перегенерировать/i}));
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText('Create page')).not.toBeInTheDocument();
  });
});
// ---------------------------------------------------------------------------
// Continue — persistence must succeed before success navigation
// ---------------------------------------------------------------------------

describe('CharacterVariantsPage – Continue button', () => {
  beforeEach(() => {
    mockedUseGenerationJob.mockReturnValue({
      job: {job_id: 'job-1', status: 'completed', progress: 100, variants: VARIANTS},
    } as never);
  });

  it('does not navigate or emit success when tree persistence fails', async () => {
    mockedCreateTreeNode.mockRejectedValue(new Error('tree persistence failed'));

    renderPage();
    fireEvent.click(screen.getByRole('button', {name: /продолжить/i}));

    await waitFor(() => expect(mockedCreateTreeNode).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Edit page')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', {name: /продолжить/i})).not.toBeDisabled();
    });
  });

  it('reuses a generated tree node id when persistence is retried', async () => {
    mockedCreateTreeNode.mockRejectedValueOnce(
      new Error('response lost after persistence'),
    );
    renderPage({...PAGE_STATE, sourceTreeNodeId: undefined}, 'job-1', null);

    fireEvent.click(screen.getByRole('button', {name: /продолжить/i}));
    await waitFor(() => expect(mockedCreateTreeNode).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.getByRole('button', {name: /продолжить/i})).not.toBeDisabled();
    });
    const firstNodeId = mockedCreateTreeNode.mock.calls[0][1].id;

    fireEvent.click(screen.getByRole('button', {name: /продолжить/i}));
    await waitFor(() => expect(mockedCreateTreeNode).toHaveBeenCalledTimes(2));

    expect(mockedCreateTreeNode.mock.calls[1][1].id).toBe(firstNodeId);
  });

  it('navigates only after tree persistence succeeds', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', {name: /продолжить/i}));

    await waitFor(() => expect(screen.getByText('Edit page')).toBeInTheDocument());
    expect(mockedCreateTreeNode).toHaveBeenCalledTimes(1);
  });

  it('starts full-body and scene generation after applying the portrait', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', {name: /продолжить/i}));

    await waitFor(() => expect(mockedApi.generateEdit).toHaveBeenCalledTimes(2));
    expect(mockedApi.generateEdit.mock.calls.map((call) => call[2])).toEqual([
      expect.objectContaining({image_type: 'full_body', region: 'body'}),
      expect.objectContaining({image_type: 'scene', region: 'style'}),
    ]);
    expect(await screen.findByText(/"full_body":"full-body-job"/)).toBeInTheDocument();
    expect(screen.getByText(/"scene":"scene-job"/)).toBeInTheDocument();
  });
});
