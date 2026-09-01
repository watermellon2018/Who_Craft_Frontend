import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {randomFillSync} from 'crypto';
import React from 'react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';

jest.mock('../profile/components/DashboardHeader', () => function MockDashboardHeader() {
  return <header>WCraft</header>;
});

import StoryboardPage from './StoryboardPage';
import type {StoryboardShot, StoryboardShotListOptions} from './model';
import {storyboardMockService} from './storyboardService';
import type {StoryboardFrontendService} from './storyboardService';
import type {EditorFrameJob, EditorFrameService} from './editorFrameJobs';
import type {ShotListJob} from './shotListJobs';
import {createMockShotList} from './useStoryboardWorkspace';
import {setStoredUserTokens} from '../../api/http';
import i18n from '../../i18n';

// These page flows mount multiple real Ant Design dialogs and the complete directing editor.
jest.setTimeout(15000);

const originalCrypto = window.crypto;
beforeAll(() => Object.defineProperty(window, 'crypto', {configurable: true, value: {getRandomValues: randomFillSync}}));
afterAll(() => Object.defineProperty(window, 'crypto', {configurable: true, value: originalCrypto}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, reject, resolve};
}

function renderStoryboard(service: StoryboardFrontendService = storyboardMockService) {
  return render(
    <MemoryRouter initialEntries={['/project/42/storyboard']}>
      <Routes>
        <Route path="/project/:projectId/storyboard" element={<StoryboardPage service={service} />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function waitForStoryboard() {
  await screen.findByText('Готово кадров: 2 / 5');
}

function clickButtonWithText(text: string) {
  const button = screen.getByText(text).closest('button');
  expect(button).not.toBeNull();
  fireEvent.click(button as HTMLButtonElement);
}

function selectScene(index: number) {
  const scene = document.querySelectorAll<HTMLButtonElement>('.storyboard-scene-button')[index];
  expect(scene).toBeDefined();
  fireEvent.click(scene);
}

function selectShot(index: number) {
  const shot = within(screen.getByRole('navigation', {name: 'Кадры сцены'})).getAllByRole('button')[index];
  expect(shot).toBeDefined();
  fireEvent.click(shot);
}

function openKitchenEditor() {
  selectScene(2);
  clickButtonWithText('Перейти к постановке');
}

const routedShotListOptions: StoryboardShotListOptions = {
  context: {characters: [], locations: [], sceneTitle: 'Scene'},
  defaultModel: 'gemini/gemini-2.5-flash',
  maxShots: 16,
  models: [{
    available: true,
    estimatedCostUsd: '0.001200',
    estimatedInputTokens: 800,
    estimatedOutputTokens: 2880,
    id: 'gemini/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'Google',
    unavailableReason: null,
  }, {
    available: true,
    estimatedCostUsd: '0.002400',
    estimatedInputTokens: 900,
    estimatedOutputTokens: 3000,
    id: 'openrouter/qwen/qwen3-235b-a22b-2507',
    label: 'Qwen3 235B A22B 2507',
    provider: 'OpenRouter',
    unavailableReason: null,
  }, {
    available: true,
    estimatedCostUsd: null,
    estimatedInputTokens: 1000,
    estimatedOutputTokens: 3200,
    id: 'openrouter/openai/gpt-5.4-mini',
    label: 'GPT-5.4 mini',
    provider: 'OpenRouter',
    unavailableReason: null,
  }],
};

test('keeps camera controls hidden until a scene and shot list are selected', async () => {
  renderStoryboard();

  await waitForStoryboard();
  expect(screen.getByRole('heading', {name: 'Выберите сцену'})).toBeInTheDocument();
  expect(screen.getByText('Готово кадров: 2 / 5')).toBeInTheDocument();
  expect(screen.queryByText('Настройки камеры')).not.toBeInTheDocument();
});

test('does not expose the redundant scene context action', async () => {
  renderStoryboard();
  await waitForStoryboard();
  selectScene(0);

  expect(screen.queryByRole('button', {name: 'Контекст сцены'})).not.toBeInTheDocument();
});

test('opens the directing workspace and adds an optional intermediate keyframe', async () => {
  renderStoryboard();
  await waitForStoryboard();
  openKitchenEditor();

  const inspector = screen.getByRole('complementary', {name: 'Параметры постановки'});
  expect(within(inspector).getByRole('combobox', {name: 'Крупность'})).toBeInTheDocument();
  expect(within(inspector).getByRole('spinbutton', {name: 'Объектив, мм'})).toHaveValue('35');
  expect(within(inspector).getByText('Движение камеры')).toBeInTheDocument();
  expect(screen.getByRole('navigation', {name: 'Кадры сцены'})).toBeInTheDocument();

  clickButtonWithText('Добавить промежуточный кадр');

  expect(screen.getAllByRole('button', {name: 'Удалить опорное изображение'})).toHaveLength(2);
  expect(screen.getAllByText('Промежуточный')).not.toHaveLength(0);
});

test('keeps the selected Schema view while moving between scene shots', async () => {
  renderStoryboard();
  await waitForStoryboard();
  openKitchenEditor();

  fireEvent.click(screen.getByRole('radio', {name: 'Схема'}));
  expect(screen.getByRole('group', {name: 'Схема кадра — вид через камеру'})).toBeInTheDocument();
  selectShot(1);

  await waitFor(() => expect(screen.getByRole('radio', {name: 'Схема'})).toBeChecked());
  expect(screen.getByRole('group', {name: 'Схема кадра — вид через камеру'})).toBeInTheDocument();
});

test('shows active image generation progress inside the image canvas', async () => {
  const scenes = await storyboardMockService.loadScenes('42');
  const shot = scenes[2].shots[0];
  const startedAt = new Date(Date.now() - 10_000).toISOString();
  const runningJob: EditorFrameJob = {
    jobId: 'editor-frame-job', sceneId: 3, shotId: shot.id, keyframeId: shot.keyframes[0].id,
    status: 'running', model: 'openrouter-flash-image', expectedRevision: 4,
    inputFingerprint: 'fingerprint', matchesCurrentDraft: true, assetId: null, imageUrl: null,
    createdAt: startedAt, startedAt, finishedAt: null, estimatedSeconds: 45,
    errorCode: null, billing: null,
  };
  const editorFrames: EditorFrameService = {
    options: async () => ({models: [], defaultModel: null, canGenerate: false}),
    list: async () => [runningJob],
    start: async () => runningJob,
  };
  renderStoryboard({...storyboardMockService, editorFrames});
  await waitForStoryboard();
  openKitchenEditor();

  const progress = await screen.findByRole('status', {name: 'Создаём изображение'});
  expect(progress.closest('.blocking-editor__image-stage')).not.toBeNull();
  expect(progress.querySelector('.ant-progress')).not.toBeNull();
  expect(progress).toHaveTextContent('Осталось примерно');
});

test('starts a newly generated shot with only the primary state and adds the ending on demand', async () => {
  renderStoryboard();
  await waitForStoryboard();
  selectScene(1);
  clickButtonWithText('Предложить shot list с ИИ');
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', {name: 'Сгенерировать shot list'}));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(await screen.findByRole('button', {name: 'Перейти к постановке'}));

  expect(screen.getByText('Основное')).toBeInTheDocument();
  expect(screen.queryByText('Конечное')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Добавить конечное'}));
  expect(screen.getByText('Конечное')).toBeInTheDocument();
});

test('adds a visible marker directly from frame notes and opens its text field', async () => {
  renderStoryboard();
  await waitForStoryboard();
  openKitchenEditor();

  const inspector = screen.getByRole('complementary', {name: 'Параметры постановки'});
  fireEvent.click(within(inspector).getByText('Заметки к кадру', {selector: 'summary'}));
  fireEvent.click(within(inspector).getByRole('button', {name: 'Добавить пометку на кадр'}));

  const text = await within(inspector).findByRole('textbox', {name: 'Пометка 1'});
  expect(text).toBeVisible();
  const notes = text.closest('details');
  const marker = screen.getByRole('button', {name: 'Комментарий 1:'});
  expect(marker).toBeInTheDocument();
  expect(within(inspector).queryByRole('spinbutton', {name: /Пометка 1 · [XY]/})).not.toBeInTheDocument();

  fireEvent.click(within(inspector).getByText('Заметки к кадру', {selector: 'summary'}));
  expect(notes).not.toHaveAttribute('open');
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  fireEvent.click(marker);
  await waitFor(() => expect(notes).toHaveAttribute('open'));
});

test('suggests the previous shot end as continuity for a new start frame', async () => {
  renderStoryboard();
  await waitForStoryboard();
  openKitchenEditor();

  selectShot(2);
  clickButtonWithText('Создать изображение');

  expect(await screen.findByText('Референсы непрерывности')).toBeInTheDocument();
  expect(screen.getByText('Shot 02 · End')).toBeInTheDocument();
  expect(screen.getByText('Shot 01 · Start')).toBeInTheDocument();
});

test('shows an actionable error when the mock shot-list service rejects', async () => {
  const service: StoryboardFrontendService = {
    ...storyboardMockService,
    suggestShotList: jest.fn().mockRejectedValue(new Error('mock failure')),
  };
  renderStoryboard(service);
  await waitForStoryboard();

  selectScene(1);
  clickButtonWithText('Предложить shot list с ИИ');

  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', {name: 'Сгенерировать shot list'}));

  await waitFor(() => expect(service.suggestShotList).toHaveBeenCalled(), {timeout: 2500});
  await waitFor(() => expect(document.querySelector('.ant-alert-error')).toHaveTextContent(
    'Не удалось создать предложение',
  ), {timeout: 2500});
});

test('opens AI configuration before requesting a shot list', async () => {
  const service: StoryboardFrontendService = {
    ...storyboardMockService,
    loadShotListOptions: jest.fn(storyboardMockService.loadShotListOptions),
    suggestShotList: jest.fn(storyboardMockService.suggestShotList),
  };
  renderStoryboard(service);
  await waitForStoryboard();

  selectScene(1);
  clickButtonWithText('Предложить shot list с ИИ');

  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).queryByText('Контекст сцены')).not.toBeInTheDocument();
  expect(within(dialog).getByRole('combobox', {name: 'Текстовая модель'})).toBeInTheDocument();
  expect(within(dialog).getByText(/0[,.]0012/)).toBeInTheDocument();
  expect(service.suggestShotList).not.toHaveBeenCalled();

  const cancelButton = within(dialog).getByRole('button', {name: 'Отмена'});
  const generateButton = within(dialog).getByRole('button', {name: 'Сгенерировать shot list'});
  expect(cancelButton).toHaveClass('craft-action-button', 'craft-action-button--secondary');
  expect(generateButton).toHaveClass('craft-action-button');
  fireEvent.click(generateButton);

  await waitFor(() => expect(service.suggestShotList).toHaveBeenCalledWith(
    expect.any(Object),
    '42',
    {maxShots: 16, model: 'mock/storyboard-director', language: 'ru'},
  ));
});

test('closes the AI configuration when the page unmounts', async () => {
  const {unmount} = renderStoryboard();
  await waitForStoryboard();

  selectScene(1);
  clickButtonWithText('Предложить shot list с ИИ');

  await screen.findByRole('dialog');
  unmount();

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('opens the screenplay passage from the directing workspace', async () => {
  renderStoryboard();
  await waitForStoryboard();
  openKitchenEditor();

  fireEvent.click(screen.getByRole('button', {name: 'Показать в сценарии'}));

  const drawer = await screen.findByRole('dialog');
  expect(within(drawer).getByRole('heading', {name: 'Wide shot'})).toBeInTheDocument();
  expect(within(drawer).getByText('Anna enters the kitchen. She notices an envelope lying on the table. She approaches it, picks it up and looks surprised.')).toBeInTheDocument();
  expect(within(drawer).getByText('Связь со сценарием не сохранена. Можно прочитать всю сцену, но выделить исходный фрагмент этого кадра нельзя.')).toBeInTheDocument();
});

test('returns through storyboard stages without losing camera settings or added keyframes', async () => {
  renderStoryboard();
  await waitForStoryboard();
  expect(screen.getByRole('link', {name: 'Вернуться к проекту'})).toBeInTheDocument();
  openKitchenEditor();

  const cameraPanel = screen.getByRole('complementary', {name: 'Параметры постановки'});
  const lens = within(cameraPanel).getByRole('spinbutton', {name: 'Объектив, мм'});
  fireEvent.change(lens, {target: {value: '85'}});
  fireEvent.blur(lens);
  clickButtonWithText('Добавить промежуточный кадр');
  fireEvent.click(screen.getByRole('button', {name: 'Вернуться к списку кадров'}));

  expect(screen.getByRole('heading', {name: /Кадры сцены ·/})).toBeInTheDocument();
  expect(screen.queryByRole('complementary', {name: 'Параметры постановки'})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Вернуться к выбору сцены'}));
  expect(screen.getByRole('heading', {name: 'Выберите сцену'})).toBeInTheDocument();

  selectScene(2);
  expect(screen.getByRole('heading', {name: /Кадры сцены ·/})).toBeInTheDocument();
  clickButtonWithText('Перейти к постановке');
  const restoredCamera = screen.getByRole('complementary', {name: 'Параметры постановки'});
  expect(within(restoredCamera).getByRole('spinbutton', {name: 'Объектив, мм'})).toHaveValue('85');
  expect(screen.getAllByRole('button', {name: 'Удалить опорное изображение'})).toHaveLength(2);
});

test('returns from manual markup to the screenplay or the existing shot list', async () => {
  renderStoryboard();
  await waitForStoryboard();
  selectScene(1);
  clickButtonWithText('Создать кадр вручную');
  fireEvent.click(screen.getByRole('button', {name: 'Вернуться к сценарию'}));
  expect(screen.getByRole('button', {name: 'Создать кадр вручную'})).toBeInTheDocument();

  selectScene(2);
  clickButtonWithText('Добавить кадр');
  fireEvent.click(screen.getByRole('button', {name: 'Вернуться к списку кадров'}));
  expect(screen.getByRole('heading', {name: /Кадры сцены ·/})).toBeInTheDocument();
});

test('shows an existing server generation after reopening and prevents another paid launch', async () => {
  const scenes = await storyboardMockService.loadScenes('42');
  const job: ShotListJob = {
    jobId: 'server-job', sceneId: 17, status: 'running', resultState: 'pending',
    model: 'qwen', language: 'ru', createdAt: new Date(Date.now() - 20000).toISOString(),
    startedAt: new Date(Date.now() - 15000).toISOString(), finishedAt: null,
    estimatedSeconds: 90, expectedRevision: 1, result: null, appliedRevision: null, errorCode: null,
  };
  const service: StoryboardFrontendService = {
    ...storyboardMockService,
    loadScenes: async () => [{...scenes[1], id: '17'}],
    shotListJobs: {
      list: jest.fn().mockResolvedValue([job]), start: jest.fn(), apply: jest.fn(), dismiss: jest.fn(),
    },
  };
  const first = renderStoryboard(service);
  await screen.findByText('Выберите сцену');
  selectScene(0);
  await screen.findByText('Генерация идёт на сервере. Можно закрыть страницу — готовые кадры сохранятся автоматически.');
  expect(screen.getByRole('button', {name: i18n.t('storyboard.ai.loading')})).toBeDisabled();
  expect(document.querySelector('.storyboard-generation-timer')).toBeInTheDocument();
  first.unmount();
  const second = renderStoryboard(service);
  await screen.findByText('Выберите сцену');
  selectScene(0);
  await screen.findByText('Генерация идёт на сервере. Можно закрыть страницу — готовые кадры сохранятся автоматически.');
  expect(service.shotListJobs?.start).not.toHaveBeenCalled();
  second.unmount();
});

test('keeps shots when restart is cancelled and returns to the original screenplay after confirmation', async () => {
  const scenes = await storyboardMockService.loadScenes('42');
  renderStoryboard();
  await waitForStoryboard();
  selectScene(2);
  const heading = `Кадры сцены · ${scenes[2].shots.length}`;
  expect(screen.getByRole('heading', {name: heading})).toBeInTheDocument();
  clickButtonWithText('Вернуться к исходникам');
  let dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent('Начать раскадровку заново?');
  expect(dialog).toHaveTextContent(scenes[2].title);
  fireEvent.click(within(dialog).getByRole('button', {name: 'Отмена'}));
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  expect(screen.getByRole('heading', {name: heading})).toBeInTheDocument();

  clickButtonWithText('Вернуться к исходникам');
  dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', {name: 'Сбросить кадры'}));
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  expect(screen.queryByRole('heading', {name: heading})).not.toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Предложить shot list с ИИ'})).toBeEnabled();
  expect(screen.getByRole('button', {name: 'Создать кадр вручную'})).toBeEnabled();
  expect(document.querySelector('.storyboard-script')?.textContent).toBe(scenes[2].text);
  selectScene(0);
  selectScene(2);
  expect(screen.getByRole('button', {name: 'Предложить shot list с ИИ'})).toBeEnabled();
});

test('updates the provider and estimate when selecting a model and submits its exact connection', async () => {
  const service: StoryboardFrontendService = {
    ...storyboardMockService,
    loadShotListOptions: jest.fn().mockResolvedValue(routedShotListOptions),
    suggestShotList: jest.fn(storyboardMockService.suggestShotList),
  };
  renderStoryboard(service);
  await waitForStoryboard();

  selectScene(1);
  clickButtonWithText('Предложить shot list с ИИ');

  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Провайдер: Google')).toBeInTheDocument();
  expect(within(dialog).getByText(/0[,.]0012/)).toBeInTheDocument();
  expect(within(dialog).getByText('Около 800 входных и до 2880 выходных токенов')).toBeInTheDocument();

  fireEvent.mouseDown(within(dialog).getByRole('combobox', {name: 'Текстовая модель'}));
  fireEvent.click(await screen.findByText('Qwen3 235B A22B 2507'));

  expect(within(dialog).getByText('Провайдер: OpenRouter')).toBeInTheDocument();
  expect(within(dialog).queryByText('Провайдер: Google')).not.toBeInTheDocument();
  expect(within(dialog).getByText(/0[,.]0024/)).toBeInTheDocument();
  expect(within(dialog).queryByText(/0[,.]0012/)).not.toBeInTheDocument();
  expect(within(dialog).getByText('Около 900 входных и до 3000 выходных токенов')).toBeInTheDocument();
  expect(service.suggestShotList).not.toHaveBeenCalled();
  expect(document.querySelector('.storyboard-script__loading--active')).not.toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole('button', {name: 'Сгенерировать shot list'}));
  await waitFor(() => expect(service.suggestShotList).toHaveBeenCalledWith(
    expect.any(Object),
    '42',
    {maxShots: 16, model: 'openrouter/qwen/qwen3-235b-a22b-2507', language: 'ru'},
  ));
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
});

test('shows screenplay progress while loading models and generating, but not during configuration', async () => {
  const pendingOptions = deferred<StoryboardShotListOptions>();
  const pendingShots = deferred<StoryboardShot[]>();
  const service: StoryboardFrontendService = {
    ...storyboardMockService,
    loadShotListOptions: jest.fn(() => pendingOptions.promise),
    suggestShotList: jest.fn(() => pendingShots.promise),
  };
  renderStoryboard(service);
  await waitForStoryboard();
  selectScene(1);
  const screenplay = document.querySelector('.storyboard-script') as HTMLElement;
  const originalText = screenplay.textContent;
  clickButtonWithText('Предложить shot list с ИИ');

  const loadingModels = within(screenplay).getByRole('status', {name: 'Загружаем модели…'});
  expect(loadingModels).toHaveClass('storyboard-script__loading--active');
  expect(loadingModels.querySelector('.ant-spin')).toBeInTheDocument();
  const suggestButton = screen.getByRole('button', {name: 'Предложить shot list с ИИ'});
  expect(suggestButton).toBeDisabled();
  expect(suggestButton.querySelector('.ant-btn-loading-icon')).not.toBeInTheDocument();
  fireEvent.click(suggestButton);
  expect(service.loadShotListOptions).toHaveBeenCalledTimes(1);
  expect(service.suggestShotList).not.toHaveBeenCalled();
  await act(async () => pendingOptions.resolve(routedShotListOptions));
  const dialog = await screen.findByRole('dialog');
  expect(document.querySelector('.storyboard-script__loading--active')).not.toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole('button', {name: 'Сгенерировать shot list'}));
  const progress = await within(screenplay).findByRole('status', {name: i18n.t('storyboard.ai.loading')});
  expect(progress).toHaveClass('storyboard-script__loading--active');
  expect(progress.querySelector('.ant-spin')).toBeInTheDocument();
  expect(within(progress).getByText(/Осталось примерно/)).toBeInTheDocument();
  expect(screenplay.textContent).toContain(originalText);
  const generatingButton = screen.getByRole('button', {name: i18n.t('storyboard.ai.loading')});
  expect(generatingButton).toBeDisabled();
  expect(generatingButton.querySelector('.ant-btn-loading-icon')).not.toBeInTheDocument();

  const scenes = await storyboardMockService.loadScenes('42');
  await act(async () => pendingShots.resolve(createMockShotList(scenes[1])));
  expect(document.querySelector('.storyboard-script__loading--active')).not.toBeInTheDocument();
  expect(screen.getByText('Перейти к постановке')).toBeInTheDocument();
});

test('clears model-loading progress on error and allows a cancelled retry', async () => {
  const pendingOptions = deferred<StoryboardShotListOptions>();
  const service: StoryboardFrontendService = {
    ...storyboardMockService,
    loadShotListOptions: jest.fn()
      .mockImplementationOnce(() => pendingOptions.promise)
      .mockResolvedValue(routedShotListOptions),
    suggestShotList: jest.fn(storyboardMockService.suggestShotList),
  };
  renderStoryboard(service);
  await waitForStoryboard();
  selectScene(1);
  clickButtonWithText('Предложить shot list с ИИ');
  expect(screen.getByRole('status', {name: 'Загружаем модели…'})).toBeInTheDocument();

  await act(async () => pendingOptions.reject(new Error('Options request failed')));

  expect(document.querySelector('.storyboard-script__loading--active')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Предложить shot list с ИИ'})).toBeEnabled();
  expect(document.querySelector('.ant-alert-error')).toHaveTextContent('Не удалось создать предложение');
  fireEvent.click(screen.getByRole('button', {name: 'Повторить'}));
  const dialog = await screen.findByRole('dialog');
  expect(document.querySelector('.storyboard-script__loading--active')).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', {name: 'Отмена'}));
  await waitFor(() => expect(dialog).not.toBeInTheDocument());

  expect(screen.getByRole('button', {name: 'Предложить shot list с ИИ'})).toBeEnabled();
  expect(document.querySelector('.storyboard-script__loading--active')).not.toBeInTheDocument();
  expect(service.suggestShotList).not.toHaveBeenCalled();
});

test('does not apply a completed AI request after authentication changes', async () => {
  const pendingShots = deferred<StoryboardShot[]>();
  const service: StoryboardFrontendService = {
    ...storyboardMockService,
    suggestShotList: jest.fn(() => pendingShots.promise),
  };
  setStoredUserTokens('original-access', 'original-refresh');
  renderStoryboard(service);
  await waitForStoryboard();
  selectScene(1);
  clickButtonWithText('Предложить shot list с ИИ');
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', {name: 'Сгенерировать shot list'}));
  await screen.findByRole('status', {name: i18n.t('storyboard.ai.loading')});
  setStoredUserTokens('another-access', 'another-refresh');
  const scenes = await storyboardMockService.loadScenes('42');
  await act(async () => pendingShots.resolve(createMockShotList(scenes[1])));
  expect(screen.queryByText('Перейти к постановке')).not.toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Предложить shot list с ИИ'})).toBeEnabled();
});

test('does not open configuration when unmounted while loading models', async () => {
  const pendingOptions = deferred<StoryboardShotListOptions>();
  const service: StoryboardFrontendService = {
    ...storyboardMockService,
    loadShotListOptions: jest.fn(() => pendingOptions.promise),
    suggestShotList: jest.fn(storyboardMockService.suggestShotList),
  };
  const {unmount} = renderStoryboard(service);
  await waitForStoryboard();
  selectScene(1);
  clickButtonWithText('Предложить shot list с ИИ');
  expect(screen.getByRole('status', {name: 'Загружаем модели…'})).toBeInTheDocument();

  unmount();
  await act(async () => pendingOptions.resolve(routedShotListOptions));

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.querySelector('.storyboard-script__loading--active')).not.toBeInTheDocument();
  expect(service.suggestShotList).not.toHaveBeenCalled();
});

test('clears screenplay progress on a malformed model response and enables retry', async () => {
  const pendingShots = deferred<StoryboardShot[]>();
  const service: StoryboardFrontendService = {
    ...storyboardMockService,
    suggestShotList: jest.fn(() => pendingShots.promise),
  };
  renderStoryboard(service);
  await waitForStoryboard();
  selectScene(1);
  clickButtonWithText('Предложить shot list с ИИ');
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', {name: 'Сгенерировать shot list'}));
  await screen.findByRole('status', {name: i18n.t('storyboard.ai.loading')});

  await act(async () => pendingShots.reject({
    error: {code: 'STORYBOARD_AI_BAD_RESPONSE', message: 'Invalid provider response'},
  }));

  expect(document.querySelector('.storyboard-script__loading--active')).not.toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Предложить shot list с ИИ'})).toBeEnabled();
  expect(document.querySelector('.ant-alert-error')).toHaveTextContent(
    'Модель вернула некорректный shot list. Попробуйте другую модель.',
  );
});

test('keeps pending progress and generated shots attached to the originating scene', async () => {
  const pendingOptions = deferred<StoryboardShotListOptions>();
  const pendingShots = deferred<StoryboardShot[]>();
  const scenes = await storyboardMockService.loadScenes('42');
  const service: StoryboardFrontendService = {
    ...storyboardMockService,
    loadScenes: async () => scenes.map((scene, index) => index === 0 ? {...scene, shots: []} : scene),
    loadShotListOptions: jest.fn(() => pendingOptions.promise),
    suggestShotList: jest.fn(() => pendingShots.promise),
  };
  renderStoryboard(service);
  await waitForStoryboard();
  selectScene(1);
  clickButtonWithText('Предложить shot list с ИИ');
  expect(screen.getByRole('status', {name: 'Загружаем модели…'})).toBeInTheDocument();
  selectScene(0);
  expect(document.querySelector('.storyboard-script__loading--active')).not.toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Предложить shot list с ИИ'})).toBeDisabled();
  selectScene(1);
  expect(screen.getByRole('status', {name: 'Загружаем модели…'})).toBeInTheDocument();
  await act(async () => pendingOptions.resolve(routedShotListOptions));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', {name: 'Сгенерировать shot list'}));
  await screen.findByRole('status', {name: i18n.t('storyboard.ai.loading')});

  selectScene(0);
  expect(document.querySelector('.storyboard-script')).toBeInTheDocument();
  expect(document.querySelector('.storyboard-script__loading--active')).not.toBeInTheDocument();
  selectScene(1);
  expect(screen.getByRole('status', {name: i18n.t('storyboard.ai.loading')})).toBeInTheDocument();
  selectScene(0);
  await act(async () => pendingShots.resolve(createMockShotList(scenes[1])));

  expect(document.querySelector('.storyboard-script')).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Предложить shot list с ИИ'})).toBeEnabled();
  selectScene(1);
  expect(screen.getByText('Перейти к постановке')).toBeInTheDocument();
});

test('removes screenplay progress when unmounted during generation', async () => {
  const pendingShots = deferred<StoryboardShot[]>();
  const service: StoryboardFrontendService = {
    ...storyboardMockService,
    suggestShotList: jest.fn(() => pendingShots.promise),
  };
  const {unmount} = renderStoryboard(service);
  await waitForStoryboard();
  selectScene(1);
  clickButtonWithText('Предложить shot list с ИИ');
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', {name: 'Сгенерировать shot list'}));
  await screen.findByRole('status', {name: i18n.t('storyboard.ai.loading')});

  unmount();
  await act(async () => pendingShots.resolve([]));
  expect(document.querySelector('.storyboard-script__loading--active')).not.toBeInTheDocument();
});

test('clears the previous estimate when the selected model has no price', async () => {
  const service: StoryboardFrontendService = {
    ...storyboardMockService,
    loadShotListOptions: jest.fn().mockResolvedValue(routedShotListOptions),
    suggestShotList: jest.fn(storyboardMockService.suggestShotList),
  };
  renderStoryboard(service);
  await waitForStoryboard();

  selectScene(1);
  clickButtonWithText('Предложить shot list с ИИ');

  const dialog = await screen.findByRole('dialog');
  fireEvent.mouseDown(within(dialog).getByRole('combobox', {name: 'Текстовая модель'}));
  fireEvent.click(await screen.findByText('GPT-5.4 mini'));

  expect(within(dialog).getByText('Оценка недоступна')).toBeInTheDocument();
  expect(within(dialog).queryByText(/0[,.]0012/)).not.toBeInTheDocument();
  expect(within(dialog).getByText('Провайдер: OpenRouter')).toBeInTheDocument();
  expect(within(dialog).getByText('Около 1000 входных и до 3200 выходных токенов')).toBeInTheDocument();
  expect(within(dialog).getByRole('button', {name: 'Сгенерировать shot list'})).toBeEnabled();
  expect(service.suggestShotList).not.toHaveBeenCalled();

  fireEvent.click(within(dialog).getByRole('button', {name: 'Отмена'}));
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
});

test('keeps generation references open and reports a rejected frame generation', async () => {
  const service: StoryboardFrontendService = {
    ...storyboardMockService,
    generateFrame: jest.fn().mockRejectedValue(new Error('mock failure')),
  };
  renderStoryboard(service);
  await waitForStoryboard();
  openKitchenEditor();

  selectShot(2);
  clickButtonWithText('Создать изображение');
  clickButtonWithText('Создать кадр');

  await waitFor(() => expect(service.generateFrame).toHaveBeenCalled(), {timeout: 2500});
  await waitFor(() => expect(document.querySelector('.ant-drawer .ant-alert-error')).toHaveTextContent(
    'Не удалось создать опорный кадр',
  ), {timeout: 2500});
  expect(screen.getByText('Референсы непрерывности')).toBeInTheDocument();

  fireEvent.click(document.querySelector('.ant-drawer-close') as HTMLButtonElement);
  selectShot(3);
  expect(document.querySelector('.blocking-editor .ant-alert-error')).not.toBeInTheDocument();
});

test('persists and renders the image URL returned by the generation service', async () => {
  const service: StoryboardFrontendService = {
    ...storyboardMockService,
    generateFrame: jest.fn().mockResolvedValue({imageUrl: '/media/storyboard/generated.jpg'}),
  };
  renderStoryboard(service);
  await waitForStoryboard();
  openKitchenEditor();

  selectShot(2);
  clickButtonWithText('Создать изображение');
  clickButtonWithText('Создать кадр');

  await waitFor(() => expect(service.generateFrame).toHaveBeenCalled(), {timeout: 2500});
  fireEvent.click(screen.getByRole('radio', {name: 'Изображение'}));
  await waitFor(() => expect(
    document.querySelector('img[src="/media/storyboard/generated.jpg"]'),
  ).toBeInTheDocument(), {timeout: 2500});
});

test('rejects an unsafe image URL returned by the generation service', async () => {
  const service: StoryboardFrontendService = {
    ...storyboardMockService,
    generateFrame: jest.fn().mockResolvedValue({imageUrl: 'javascript:alert(1)'}),
  };
  renderStoryboard(service);
  await waitForStoryboard();
  openKitchenEditor();

  selectShot(2);
  clickButtonWithText('Создать изображение');
  clickButtonWithText('Создать кадр');

  await waitFor(() => expect(service.generateFrame).toHaveBeenCalled(), {timeout: 2500});
  await waitFor(() => expect(document.querySelector('.ant-drawer .ant-alert-error')).toHaveTextContent(
    'Не удалось создать опорный кадр',
  ), {timeout: 2500});
  expect(document.querySelector('img[src^="javascript:"]')).not.toBeInTheDocument();
});
