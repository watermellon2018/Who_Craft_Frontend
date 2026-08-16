import React from 'react';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {Modal} from 'antd';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';
import {getGenerationRoutingMode} from '../../credits/api/creditApi';
import {runGenerationWithCredits} from '../../credits/components/GenerationCostGuard';
import {characterApi} from '../api/characterApi';
import CharacterVariantsPage from './CharacterVariantsPage';

jest.mock('../api/characterApi');
jest.mock('../../credits/api/creditApi', () => ({
  getGenerationRoutingMode: jest.fn(() => 'manual'),
  notifyCreditBalanceUpdated: jest.fn(),
}));
jest.mock('../../credits/components/GenerationCostGuard', () => ({
  ...jest.requireActual('../../credits/components/GenerationCostGuard'),
  GenerationCostPreview: () => null,
  formatGenerationCost: (value: string) => Number(value).toFixed(6).replace(/0+$/, '').replace(/\.$/, ''),
  GENERATION_COST_MODAL_THEME: {className: 'generation-cost-modal'},
  runGenerationWithCredits: jest.fn(),
}));
jest.mock('../hooks/useGenerationJob', () => ({
  useGenerationJob: jest.fn(),
}));
jest.mock('../hooks/useImageModelCatalog', () => ({
  useImageModelCatalog: jest.fn(),
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
import {useImageModelCatalog} from '../hooks/useImageModelCatalog';

const mockedApi = characterApi as jest.Mocked<typeof characterApi>;
const mockedGetGenerationRoutingMode = getGenerationRoutingMode as jest.MockedFunction<typeof getGenerationRoutingMode>;
const mockedCreateTreeNode = characterTreeApi.create as jest.MockedFunction<typeof characterTreeApi.create>;
const mockedUseGenerationJob = useGenerationJob as jest.MockedFunction<typeof useGenerationJob>;
const mockedUseImageModelCatalog = useImageModelCatalog as jest.MockedFunction<typeof useImageModelCatalog>;
const mockedRunGenerationWithCredits = runGenerationWithCredits as jest.MockedFunction<typeof runGenerationWithCredits>;

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

const COST_ESTIMATE = {
  domain: 'character',
  operation: 'generate',
  provider: 'openrouter',
  modelKey: 'openrouter-images:openai/gpt-image-1',
  modelName: 'openai/gpt-image-1',
  currency: 'USD' as const,
  estimatedCost: '0.134002',
  reservationAmount: '0.134002',
  pricingSource: 'openrouter',
  costIsEstimate: true,
  availableBalance: '4.45',
  sufficientBalance: true,
  accountFrozen: false,
  routingMode: 'manual' as const,
  routingReason: 'manual-selection',
  routeCandidates: [],
};

const SECONDARY_QUOTE = {
  quote_token: 'quote-full_body-scene',
  expires_in_seconds: 300,
  items: [
    {
      image_type: 'full_body' as const,
      estimated_cost: '0.060001',
      reservation_amount: '0.060001',
      provider: 'openrouter',
      model_key: 'openrouter-images:openai/gpt-image-1',
      model_name: 'GPT Image 1',
      routing_mode: 'manual' as const,
    },
    {
      image_type: 'scene' as const,
      estimated_cost: '0.074001',
      reservation_amount: '0.074001',
      provider: 'openrouter',
      model_key: 'openrouter-images:openai/gpt-image-1',
      model_name: 'GPT Image 1',
      routing_mode: 'manual' as const,
    },
  ],
  totals: {
    estimated_cost: '0.134002',
    reservation_amount: '0.134002',
  },
  available_balance: '4.45',
  sufficient_balance: true,
  account_frozen: false,
};

function secondaryQuoteFor(imageTypes: Array<'full_body' | 'scene'>) {
  const items = SECONDARY_QUOTE.items.filter((item) => imageTypes.includes(item.image_type));
  const singleItem = items.length === 1 ? items[0] : null;
  return {
    ...SECONDARY_QUOTE,
    quote_token: `quote-${imageTypes.join('-')}`,
    items,
    totals: singleItem
      ? {
          estimated_cost: singleItem.estimated_cost,
          reservation_amount: singleItem.reservation_amount,
        }
      : SECONDARY_QUOTE.totals,
  };
}

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
  mockedGetGenerationRoutingMode.mockReturnValue('manual');
  mockedUseImageModelCatalog.mockReturnValue({catalog: null, error: false, loading: false});
  mockedRunGenerationWithCredits.mockImplementation(async (intent, operation) => operation({
    ...COST_ESTIMATE,
    modelKey: intent.modelKey ?? COST_ESTIMATE.modelKey,
  }));
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
  mockedApi.quoteSecondaryAssets.mockImplementation(async (_projectId, _characterId, payload) => ({
    data: secondaryQuoteFor(payload.image_types),
  }) as never);
  mockedApi.generateSecondaryAssets.mockImplementation(async (_projectId, _characterId, quoteToken) => ({
    data: {
      jobs: [
        ...(quoteToken.includes('full_body')
          ? [{job_id: 'full-body-job', status: 'queued', image_type: 'full_body', error_code: null, error_message: null}]
          : []),
        ...(quoteToken.includes('scene')
          ? [{job_id: 'scene-job', status: 'queued', image_type: 'scene', error_code: null, error_message: null}]
          : []),
      ],
      total_reservation_amount: quoteToken === 'quote-full_body-scene' ? '0.134002' : '0.060001',
    },
  }) as never);
  mockedApi.listGenerationJobs.mockResolvedValue({data: {jobs: []}} as never);
  mockedApi.requestGenerationJobCancellation.mockResolvedValue({
    data: {job_id: 'job-1', status: 'cancellation_requested', progress: 40, variants: []},
  } as never);
});

afterEach(async () => {
  await act(async () => {
    Modal.destroyAll();
    await Promise.resolve();
  });
  await waitFor(() => expect(screen.queryAllByRole('dialog')).toHaveLength(0));
});

async function openSecondaryGenerationDialog() {
  const existingDialogs = new Set(screen.queryAllByRole('dialog'));
  fireEvent.click(screen.getByRole('button', {name: /продолжить/i}));
  let dialog: HTMLElement | undefined;
  await waitFor(() => {
    dialog = screen.queryAllByRole('dialog').find((candidate) => !existingDialogs.has(candidate));
    expect(dialog).toBeDefined();
  });
  return dialog as HTMLElement;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('CharacterVariantsPage – initial state', () => {
  it('shows loading state while job is processing', () => {
    mockedUseGenerationJob.mockReturnValue({job: {job_id: 'job-1', status: 'processing', progress: 40, variants: []}} as never);
    renderPage();
    expect(screen.getByText(/генерируем портретные варианты/i)).toBeInTheDocument();
  });


  it('allows cancellation while the initial generation is queued', async () => {
    mockedUseGenerationJob.mockReturnValue({
      job: {job_id: 'job-1', status: 'queued', progress: 0, variants: []},
      loading: false,
    } as never);

    renderPage();
    fireEvent.click(await screen.findByRole('button', {name: 'Отменить генерацию'}));

    await waitFor(() => expect(mockedApi.requestGenerationJobCancellation).toHaveBeenCalledWith('job-1'));
  });

  it('does not allow cancellation after the initial generation starts', async () => {
    mockedUseGenerationJob.mockReturnValue({
      job: {job_id: 'job-1', status: 'processing', progress: 40, variants: []},
      loading: false,
    } as never);

    renderPage();

    expect(await screen.findByText('Генерация уже запущена, отменить её нельзя.')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Отменить генерацию'})).not.toBeInTheDocument();
    expect(mockedApi.requestGenerationJobCancellation).not.toHaveBeenCalled();
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
    const dialog = await openSecondaryGenerationDialog();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Сохранить только портрет'}));

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

  it('explains a blocked child generation and retries with a configured OpenRouter GPT Image model', async () => {
    mockedUseGenerationJob.mockReturnValue({
      job: {
        job_id: 'job-child',
        status: 'failed',
        progress: 0,
        variants: [],
        error_code: 'IMAGE_PROVIDER_BLOCKED',
        request_payload: {
          age: 5,
          appearance_description: 'A fictional child adventurer',
          image_model: 'openrouter-images:openai/gpt-image-current',
          variant_count: 2,
        },
      },
    } as never);
    mockedUseImageModelCatalog.mockReturnValue({
      error: false,
      loading: false,
      catalog: {
        current: 'openrouter-images:openai/gpt-image-current',
        source: 'profile',
        configured: true,
        stored: null,
        available: [
          {
            key: 'openrouter-images:openai/gpt-image-current',
            label: 'Current GPT Image',
            backend: 'openrouter',
            model_id: 'openrouter/openai/gpt-image-current',
            mode: 'generate',
            supports_generate: true,
            supports_edit: true,
            supports_reference: true,
            supported_parameters: {},
            input_modalities: ['text'],
            output_modalities: ['image'],
            default: true,
            configured: true,
            requires_env: [],
          },
          {
            key: 'openrouter-images:openai/gpt-image-1.5',
            label: 'GPT Image 1.5',
            backend: 'openrouter',
            model_id: 'openrouter/openai/gpt-image-1.5',
            mode: 'generate',
            supports_generate: true,
            supports_edit: true,
            supports_reference: true,
            supported_parameters: {},
            input_modalities: ['text'],
            output_modalities: ['image'],
            default: false,
            configured: true,
            requires_env: [],
          },
          {
            key: 'openrouter-images:openai/gpt-image-unconfigured',
            label: 'Unavailable GPT Image',
            backend: 'openrouter',
            model_id: 'openrouter/openai/gpt-image-unconfigured',
            mode: 'generate',
            supports_generate: true,
            supports_edit: true,
            supports_reference: true,
            supported_parameters: {},
            input_modalities: ['text'],
            output_modalities: ['image'],
            default: false,
            configured: false,
            requires_env: ['OPENROUTER_API_KEY'],
          },
        ],
      },
    });

    renderPage();

    expect(screen.getByText('Эта модель не поддерживает генерацию персонажей указанного возраста.')).toBeInTheDocument();
    expect(screen.getByText(/безопасного образа вымышленного ребёнка/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Current GPT Image/})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Unavailable GPT Image/})).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Попробовать GPT Image 1.5'}));

    await waitFor(() => expect(mockedApi.generateInitial).toHaveBeenCalledTimes(1));
    expect(mockedRunGenerationWithCredits).toHaveBeenCalledWith(
      expect.objectContaining({
        modelKey: 'openrouter-images:openai/gpt-image-1.5',
        routingMode: 'manual',
      }),
      expect.any(Function),
    );
    expect(mockedApi.generateInitial.mock.calls[0][2]).toEqual(expect.objectContaining({
      image_model: 'openrouter-images:openai/gpt-image-1.5',
      routing_mode: 'manual',
      age: 5,
    }));
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

  it('keeps the user on variants and performs no mutations when the dialog is cancelled', async () => {
    renderPage();
    const dialog = await openSecondaryGenerationDialog();

    fireEvent.click(within(dialog).getByRole('button', {name: 'Отмена'}));

    await waitFor(() => {
      expect(screen.queryByText('Создать дополнительные изображения?')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('img', {name: 'Вариант 1'})).toBeInTheDocument();
    expect(mockedApi.applyVariant).not.toHaveBeenCalled();
    expect(mockedCreateTreeNode).not.toHaveBeenCalled();
    expect(mockedApi.generateSecondaryAssets).not.toHaveBeenCalled();
    expect(screen.queryByText('Edit page')).not.toBeInTheDocument();
  });

  it('explains the two extra generations and shows individual and total costs', async () => {
    renderPage();
    const dialog = await openSecondaryGenerationDialog();

    expect(within(dialog).getByRole('checkbox', {name: /В полный рост/})).toBeChecked();
    expect(within(dialog).getByRole('checkbox', {name: /В сцене/})).toBeChecked();
    await waitFor(() => {
      expect(within(dialog).getByText('≈ 0.060001 C')).toBeInTheDocument();
      expect(within(dialog).getByText('≈ 0.074001 C')).toBeInTheDocument();
    });
    expect(within(dialog).getByText('Итого за выбранные изображения')).toBeInTheDocument();
    expect(within(dialog).getByText('≈ 0.134002 C')).toBeInTheDocument();
    expect(within(dialog).getByText(/Сохранение портрета не требует новой генерации/)).toBeInTheDocument();
    expect(mockedApi.quoteSecondaryAssets).toHaveBeenCalledTimes(1);
    expect(mockedApi.quoteSecondaryAssets).toHaveBeenCalledWith(PROJECT_ID, CHARACTER_ID, {
      variant_id: 'v1',
      image_types: ['full_body', 'scene'],
      image_model: 'openrouter-images:openai/gpt-image-1',
      routing_mode: 'manual',
    });
    fireEvent.click(within(dialog).getByRole('button', {name: 'Отмена'}));
  });

  it('saves only the portrait without launching secondary jobs', async () => {
    renderPage();
    const dialog = await openSecondaryGenerationDialog();

    fireEvent.click(within(dialog).getByRole('button', {name: 'Сохранить только портрет'}));

    await waitFor(() => expect(screen.getByText('Edit page')).toBeInTheDocument());
    expect(mockedApi.applyVariant).toHaveBeenCalledTimes(1);
    expect(mockedCreateTreeNode).toHaveBeenCalledTimes(1);
    expect(mockedApi.generateSecondaryAssets).not.toHaveBeenCalled();
  });

  it('still allows saving only the portrait when cost estimates are unavailable', async () => {
    mockedApi.quoteSecondaryAssets.mockRejectedValue(new Error('pricing unavailable'));
    renderPage();

    const dialog = await openSecondaryGenerationDialog();

    await waitFor(() => {
      expect(within(dialog).getByText(/Не удалось рассчитать стоимость/)).toBeInTheDocument();
    });
    expect(within(dialog).getByRole('button', {name: 'Сохранить и сгенерировать'})).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Сохранить только портрет'}));

    await waitFor(() => expect(screen.getByText('Edit page')).toBeInTheDocument());
    expect(mockedApi.applyVariant).toHaveBeenCalledTimes(1);
    expect(mockedCreateTreeNode).toHaveBeenCalledTimes(1);
    expect(mockedApi.generateSecondaryAssets).not.toHaveBeenCalled();
  });

  it('opens immediately and saves the portrait while the cost estimate is still pending', async () => {
    mockedApi.quoteSecondaryAssets.mockImplementation(() => new Promise(() => {}));
    renderPage();

    const dialog = await openSecondaryGenerationDialog();

    expect(within(dialog).getByText(/Рассчитываем стоимость/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', {name: 'Сохранить и сгенерировать'})).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Сохранить только портрет'}));

    await waitFor(() => expect(screen.getByText('Edit page')).toBeInTheDocument());
    expect(mockedApi.applyVariant).toHaveBeenCalledTimes(1);
    expect(mockedApi.generateSecondaryAssets).not.toHaveBeenCalled();
  });

  it('allows one selected image when the balance covers one but not two', async () => {
    mockedApi.quoteSecondaryAssets.mockImplementation(async (_projectId, _characterId, payload) => ({
      data: {
        ...secondaryQuoteFor(payload.image_types),
        available_balance: '0.10',
        sufficient_balance: payload.image_types.length === 1,
      },
    }) as never);
    renderPage();

    const dialog = await openSecondaryGenerationDialog();
    const generateButton = within(dialog).getByRole('button', {name: 'Сохранить и сгенерировать'});
    fireEvent.click(within(dialog).getByRole('checkbox', {name: /В сцене/}));
    await waitFor(() => expect(generateButton).not.toBeDisabled());
    fireEvent.click(generateButton);

    await waitFor(() => expect(mockedApi.generateSecondaryAssets).toHaveBeenCalledTimes(1));
    expect(mockedApi.generateSecondaryAssets).toHaveBeenCalledWith(
      PROJECT_ID,
      CHARACTER_ID,
      'quote-full_body',
    );
  });

  it('does not apply the portrait or partially start jobs when two edits exceed the balance', async () => {
    mockedApi.quoteSecondaryAssets.mockResolvedValue({
      data: {
        ...SECONDARY_QUOTE,
        available_balance: '0.10',
        sufficient_balance: false,
      },
    } as never);
    renderPage();

    const dialog = await openSecondaryGenerationDialog();
    const generateButton = within(dialog).getByRole('button', {name: 'Сохранить и сгенерировать'});
    await waitFor(() => {
      expect(within(dialog).getByText(/Для запуска нужно примерно/)).toBeInTheDocument();
    });
    expect(generateButton).toBeDisabled();
    fireEvent.click(generateButton);

    expect(mockedApi.applyVariant).not.toHaveBeenCalled();
    expect(mockedCreateTreeNode).not.toHaveBeenCalled();
    expect(mockedApi.generateSecondaryAssets).not.toHaveBeenCalled();
    expect(screen.queryByText('Edit page')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Отмена'}));
  });

  it('allows saving only the portrait when the wallet is frozen', async () => {
    mockedApi.quoteSecondaryAssets.mockResolvedValue({
      data: {...SECONDARY_QUOTE, account_frozen: true},
    } as never);
    renderPage();

    const dialog = await openSecondaryGenerationDialog();
    await waitFor(() => {
      expect(within(dialog).getByText(/администратор не разморозит кошелёк/)).toBeInTheDocument();
    });
    expect(within(dialog).getByRole('button', {name: 'Сохранить и сгенерировать'})).toBeDisabled();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Сохранить только портрет'}));

    await waitFor(() => expect(screen.getByText('Edit page')).toBeInTheDocument());
    expect(mockedApi.generateSecondaryAssets).not.toHaveBeenCalled();
  });

  it('does not navigate or emit success when tree persistence fails', async () => {
    mockedCreateTreeNode.mockRejectedValue(new Error('tree persistence failed'));

    renderPage();
    const dialog = await openSecondaryGenerationDialog();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Сохранить только портрет'}));

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

    let dialog = await openSecondaryGenerationDialog();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Сохранить только портрет'}));
    await waitFor(() => expect(mockedCreateTreeNode).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.getByRole('button', {name: /продолжить/i})).not.toBeDisabled();
    });
    const firstNodeId = mockedCreateTreeNode.mock.calls[0][1].id;

    dialog = await openSecondaryGenerationDialog();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Сохранить только портрет'}));
    await waitFor(() => expect(mockedApi.applyVariant).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockedCreateTreeNode).toHaveBeenCalledTimes(2));

    expect(mockedCreateTreeNode.mock.calls[1][1].id).toBe(firstNodeId);
  });

  it('navigates only after tree persistence succeeds', async () => {
    renderPage();
    const dialog = await openSecondaryGenerationDialog();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Сохранить только портрет'}));

    await waitFor(() => expect(screen.getByText('Edit page')).toBeInTheDocument());
    expect(mockedCreateTreeNode).toHaveBeenCalledTimes(1);
  });

  it('starts full-body and scene atomically with the approved quote token', async () => {
    renderPage();
    const dialog = await openSecondaryGenerationDialog();
    const generateButton = within(dialog).getByRole('button', {name: 'Сохранить и сгенерировать'});
    await waitFor(() => expect(generateButton).not.toBeDisabled());
    fireEvent.click(generateButton);

    await waitFor(() => expect(mockedApi.generateSecondaryAssets).toHaveBeenCalledTimes(1));
    expect(mockedApi.generateSecondaryAssets).toHaveBeenCalledWith(
      PROJECT_ID,
      CHARACTER_ID,
      'quote-full_body-scene',
    );
    expect(await screen.findByText(/"full_body":"full-body-job"/)).toBeInTheDocument();
    expect(screen.getByText(/"scene":"scene-job"/)).toBeInTheDocument();
  });

  it('launches only the selected secondary image type', async () => {
    renderPage();
    const dialog = await openSecondaryGenerationDialog();

    fireEvent.click(within(dialog).getByRole('checkbox', {name: /В сцене/}));
    await waitFor(() => expect(within(dialog).getAllByText('≈ 0.060001 C')).toHaveLength(2));
    const generateButton = within(dialog).getByRole('button', {name: 'Сохранить и сгенерировать'});
    await waitFor(() => expect(generateButton).not.toBeDisabled());
    fireEvent.click(generateButton);

    await waitFor(() => expect(mockedApi.generateSecondaryAssets).toHaveBeenCalledTimes(1));
    expect(mockedApi.quoteSecondaryAssets).toHaveBeenLastCalledWith(
      PROJECT_ID,
      CHARACTER_ID,
      expect.objectContaining({image_types: ['full_body']}),
    );
    expect(mockedApi.generateSecondaryAssets).toHaveBeenCalledWith(
      PROJECT_ID,
      CHARACTER_ID,
      'quote-full_body',
    );
    expect(screen.getByText(/"full_body":"full-body-job"/)).toBeInTheDocument();
    expect(screen.queryByText(/"scene":"scene-job"/)).not.toBeInTheDocument();
  });

  it('ignores a stale quote after the selected image types change', async () => {
    let resolveInitialQuote: ((value: unknown) => void) | undefined;
    mockedApi.quoteSecondaryAssets.mockImplementation(async (_projectId, _characterId, payload) => {
      if (payload.image_types.length === 2) {
        return new Promise((resolve) => {
          resolveInitialQuote = resolve;
        }) as never;
      }
      return {data: secondaryQuoteFor(payload.image_types)} as never;
    });
    renderPage();
    const dialog = await openSecondaryGenerationDialog();

    fireEvent.click(within(dialog).getByRole('checkbox', {name: /В сцене/}));
    const generateButton = within(dialog).getByRole('button', {name: 'Сохранить и сгенерировать'});
    await waitFor(() => expect(generateButton).not.toBeDisabled());

    await act(async () => {
      resolveInitialQuote?.({data: SECONDARY_QUOTE});
      await Promise.resolve();
    });
    expect(generateButton).not.toBeDisabled();
    fireEvent.click(generateButton);

    await waitFor(() => expect(mockedApi.generateSecondaryAssets).toHaveBeenCalledWith(
      PROJECT_ID,
      CHARACTER_ID,
      'quote-full_body',
    ));
  });

  it('keeps the applied portrait on variants when the atomic batch launch fails', async () => {
    mockedApi.generateSecondaryAssets.mockRejectedValue(new Error('batch rejected'));
    renderPage();
    let dialog = await openSecondaryGenerationDialog();
    const generateButton = within(dialog).getByRole('button', {name: 'Сохранить и сгенерировать'});
    await waitFor(() => expect(generateButton).not.toBeDisabled());
    fireEvent.click(generateButton);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Портрет сохранён, но дополнительные изображения не запущены',
    );
    expect(screen.queryByText('Edit page')).not.toBeInTheDocument();
    expect(mockedApi.applyVariant).toHaveBeenCalledTimes(1);
    expect(mockedCreateTreeNode).toHaveBeenCalledTimes(1);

    dialog = await openSecondaryGenerationDialog();
    fireEvent.click(within(dialog).getByRole('button', {name: 'Сохранить только портрет'}));

    await waitFor(() => expect(screen.getByText('Edit page')).toBeInTheDocument());
    expect(mockedApi.applyVariant).toHaveBeenCalledTimes(1);
    expect(mockedCreateTreeNode).toHaveBeenCalledTimes(1);
  });
});
