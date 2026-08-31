import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import React from 'react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';

jest.mock('../profile/components/DashboardHeader', () => function MockDashboardHeader() {
  return <header>WCraft</header>;
});

import StoryboardPage from './StoryboardPage';
import type {StoryboardShot, StoryboardShotListOptions} from './model';
import {storyboardMockService} from './storyboardService';
import type {StoryboardFrontendService} from './storyboardService';
import {createMockShotList} from './useStoryboardWorkspace';

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
  const shot = document.querySelectorAll<HTMLButtonElement>('.storyboard-shot-button__select')[index];
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

  expect(document.querySelector('.storyboard-camera-header h3')).toHaveTextContent(
    'Настройки камеры · 0%',
  );
  const tabs = Array.from(document.querySelectorAll('.ant-tabs-tab')).map((tab) => tab.textContent);
  expect(tabs).toEqual(expect.arrayContaining(['Камера', 'Композиция', 'Движение']));
  const shotsSidebar = document.querySelector('.storyboard-shots');
  expect(shotsSidebar).not.toBeNull();
  expect(within(shotsSidebar as HTMLElement).getByText('Общий')).toBeInTheDocument();

  clickButtonWithText('Добавить промежуточный кадр');

  expect(document.querySelector('button[aria-label="Удалить промежуточный кадр"]')).toBeInTheDocument();
  expect(screen.getAllByText('Промежуточный')).not.toHaveLength(0);
});

test('suggests the previous shot end as continuity for a new start frame', async () => {
  renderStoryboard();
  await waitForStoryboard();
  openKitchenEditor();

  selectShot(2);
  clickButtonWithText('Создать storyboard frame');

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
    {maxShots: 16, model: 'mock/storyboard-director'},
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
    {maxShots: 16, model: 'openrouter/qwen/qwen3-235b-a22b-2507'},
  ));
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
});

test('shows progress over the screenplay only after confirming and clears it on success', async () => {
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

  expect(document.querySelector('.storyboard-script__loading--active')).not.toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Предложить shot list с ИИ'})).toBeDisabled();
  await act(async () => pendingOptions.resolve(routedShotListOptions));
  const dialog = await screen.findByRole('dialog');
  expect(document.querySelector('.storyboard-script__loading--active')).not.toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole('button', {name: 'Сгенерировать shot list'}));
  const progress = await within(screenplay).findByRole('status', {name: 'Создаём shot list…'});
  expect(progress).toHaveClass('storyboard-script__loading--active');
  expect(progress.querySelector('.ant-spin')).toBeInTheDocument();
  expect(screenplay.textContent).toContain(originalText);
  const generatingButton = screen.getByRole('button', {name: 'Создаём shot list…'});
  expect(generatingButton).toBeDisabled();
  expect(generatingButton.querySelector('.ant-btn-loading-icon')).not.toBeInTheDocument();

  const scenes = await storyboardMockService.loadScenes('42');
  await act(async () => pendingShots.resolve(createMockShotList(scenes[1])));
  expect(document.querySelector('.storyboard-script__loading--active')).not.toBeInTheDocument();
  expect(screen.getByText('Перейти к постановке')).toBeInTheDocument();
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
  await screen.findByRole('status', {name: 'Создаём shot list…'});

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
  const pendingShots = deferred<StoryboardShot[]>();
  const scenes = await storyboardMockService.loadScenes('42');
  const service: StoryboardFrontendService = {
    ...storyboardMockService,
    loadScenes: async () => scenes.map((scene, index) => index === 0 ? {...scene, shots: []} : scene),
    suggestShotList: jest.fn(() => pendingShots.promise),
  };
  renderStoryboard(service);
  await waitForStoryboard();
  selectScene(1);
  clickButtonWithText('Предложить shot list с ИИ');
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', {name: 'Сгенерировать shot list'}));
  await screen.findByRole('status', {name: 'Создаём shot list…'});

  selectScene(0);
  expect(document.querySelector('.storyboard-script')).toBeInTheDocument();
  expect(document.querySelector('.storyboard-script__loading--active')).not.toBeInTheDocument();
  selectScene(1);
  expect(screen.getByRole('status', {name: 'Создаём shot list…'})).toBeInTheDocument();
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
  await screen.findByRole('status', {name: 'Создаём shot list…'});

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
  clickButtonWithText('Создать storyboard frame');
  clickButtonWithText('Создать кадр');

  await waitFor(() => expect(service.generateFrame).toHaveBeenCalled(), {timeout: 2500});
  await waitFor(() => expect(document.querySelector('.ant-drawer .ant-alert-error')).toHaveTextContent(
    'Не удалось создать опорный кадр',
  ), {timeout: 2500});
  expect(screen.getByText('Референсы непрерывности')).toBeInTheDocument();

  fireEvent.click(document.querySelector('.ant-drawer-close') as HTMLButtonElement);
  selectShot(3);
  expect(document.querySelector('.storyboard-viewport .ant-alert-error')).not.toBeInTheDocument();
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
  clickButtonWithText('Создать storyboard frame');
  clickButtonWithText('Создать кадр');

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
  clickButtonWithText('Создать storyboard frame');
  clickButtonWithText('Создать кадр');

  await waitFor(() => expect(service.generateFrame).toHaveBeenCalled(), {timeout: 2500});
  await waitFor(() => expect(document.querySelector('.ant-drawer .ant-alert-error')).toHaveTextContent(
    'Не удалось создать опорный кадр',
  ), {timeout: 2500});
  expect(document.querySelector('img[src^="javascript:"]')).not.toBeInTheDocument();
});
