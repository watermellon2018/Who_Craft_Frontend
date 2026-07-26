import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {characterApi} from '../api/characterApi';
import CharacterVariantsPage from './CharacterVariantsPage';

jest.mock('../api/characterApi');
jest.mock('../hooks/useGenerationJob', () => ({
  useGenerationJob: jest.fn(),
}));
jest.mock('../../../api/generation/characters/tree_structure', () => ({
  createCharacterFromTreeAPI: jest.fn().mockResolvedValue({}),
}));
jest.mock('../events', () => ({
  notifyCharacterListUpdated: jest.fn(),
  notifyCharacterTreeUpdated: jest.fn(),
}));

import {useGenerationJob} from '../hooks/useGenerationJob';

const mockedApi = characterApi as jest.Mocked<typeof characterApi>;
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
  generationOptions: {count: 2 as const, creativity: 'balanced' as const, lockSeed: false, seed: ''},
};

function renderPage(locationState = PAGE_STATE) {
  return render(
    <MemoryRouter
      initialEntries={[{pathname: `/project/${PROJECT_ID}/characters/${CHARACTER_ID}/variants`, state: locationState}]}
    >
      <Routes>
        <Route
          path="/project/:projectId/characters/:characterId/variants"
          element={<CharacterVariantsPage />}
        />
        <Route path="/project/:projectId/characters/create" element={<div>Create page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.applyVariant.mockResolvedValue({data: {}} as never);
  mockedApi.generateInitial.mockResolvedValue({
    data: {job_id: 'job-regen', status: 'queued', progress: 0, variants: []},
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

  it('displays variant cards when job is completed', () => {
    mockedUseGenerationJob.mockReturnValue({
      job: {job_id: 'job-1', status: 'completed', progress: 100, variants: VARIANTS},
    } as never);
    renderPage();
    expect(screen.getByRole('img', {name: 'Вариант 1'})).toBeInTheDocument();
    expect(screen.getByRole('img', {name: 'Вариант 2'})).toBeInTheDocument();
  });

  it('shows error state on job failure', () => {
    mockedUseGenerationJob.mockReturnValue({
      job: {job_id: 'job-1', status: 'failed', progress: 0, variants: [], error_message: 'Что-то пошло не так'},
    } as never);
    renderPage();
    expect(screen.getByText(/ошибка генерации/i)).toBeInTheDocument();
    expect(screen.getByText('Что-то пошло не так')).toBeInTheDocument();
  });

  it('shows "no context" error when navigated to without state', () => {
    mockedUseGenerationJob.mockReturnValue({job: null} as never);
    renderPage({} as never);
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
