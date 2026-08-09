import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes, useNavigate} from 'react-router-dom';

import {newReferenceIdempotencyKey, referenceApi} from '../api/referenceApi';
import VisualReferenceCreatePage from './VisualReferenceCreatePage';

jest.mock('../api/referenceApi');
jest.mock('../components/ReferenceLibraryShell', () => ({
  __esModule: true,
  default: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));
jest.mock('../../../utils/useUnsavedChangesGuard', () => ({
  useUnsavedChangesGuard: () => ({allowNextNavigation: jest.fn()}),
}));

const mockedApi = referenceApi as jest.Mocked<typeof referenceApi>;
const mockedIdempotencyKey = newReferenceIdempotencyKey as jest.MockedFunction<
  typeof newReferenceIdempotencyKey
>;
const promptPlaceholder = 'Опишите композицию, освещение, материалы, цвета и важные детали изображения';

jest.setTimeout(15_000);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/project/7/references/create?category=location']}>
      <Routes>
        <Route path="/project/:projectId/references/create" element={<CreateRoute />} />
        <Route
          path="/project/:projectId/references/:referenceId/edit"
          element={<div>reference editor</div>}
        />
        <Route
          path="/project/:projectId/references/:referenceId"
          element={<div>reference detail</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function CreateRoute() {
  const navigate = useNavigate();
  return (
    <>
      <button
        type="button"
        onClick={() => navigate('/project/8/references/create?category=prop')}
      >
        switch project
      </button>
      <VisualReferenceCreatePage />
    </>
  );
}

function completedJob(jobId = 'job-1', variantId = 'generated-1', imageNumber = 1) {
  return {data: {
    attempts: 1,
    canCancel: false,
    canRetry: false,
    completedAt: '2026-08-09T12:01:00Z',
    createdAt: '2026-08-09T12:00:00Z',
    error: null,
    id: jobId,
    operation: 'generate',
    progress: 100,
    referenceId: 'ref-1',
    stage: 'finalized',
    status: 'completed',
    variantCount: 4,
    variants: [{
      height: 1080,
      id: variantId,
      imageUrl: `https://cdn.example/generated-${imageNumber}.png`,
      index: 0,
      status: 'generated',
      thumbnailUrl: `https://cdn.example/generated-${imageNumber}-thumb.png`,
      width: 1920,
    }],
  }} as never;
}

async function waitForEditor() {
  await waitFor(() => expect(
    screen.getByLabelText('Название визуальной опоры'),
  ).toBeEnabled());
}

function fillGenerationFields(prompt = 'Ночная квартира, тёплый практический свет') {
  fireEvent.change(screen.getByLabelText('Название визуальной опоры'), {
    target: {value: 'Квартира Анны'},
  });
  fireEvent.change(screen.getByPlaceholderText(promptPlaceholder), {
    target: {value: prompt},
  });
}

async function generatePreview(expectedName = 'Сгенерированное изображение 1') {
  fireEvent.click(screen.getByRole('button', {name: 'Сгенерировать'}));
  expect(await screen.findByRole(
    'img',
    {name: expectedName},
    {timeout: 5_000},
  )).toBeInTheDocument();
}

async function addCurrentPreview() {
  fireEvent.click(screen.getByRole('button', {name: 'Добавить в черновики'}));
  await waitFor(() => expect(
    screen.queryByRole('button', {name: 'Добавить в черновики'}),
  ).not.toBeInTheDocument(), {timeout: 3_000});
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedIdempotencyKey.mockReturnValue('reference:test-generation');
  mockedApi.getCapabilities.mockResolvedValue({data: {
    categories: [
      {key: 'location', label: 'Локация'},
      {key: 'prop', label: 'Предмет'},
      {key: 'wardrobe', label: 'Одежда'},
      {key: 'vehicle', label: 'Транспорт'},
      {key: 'symbol', label: 'Символ'},
      {key: 'other', label: 'Другое'},
    ],
    generation: {
      aspectRatios: ['16:9'],
      canEdit: true,
      canGenerate: true,
      configured: true,
      editVariantCounts: [1],
      effectiveModel: 'configured-model',
      generateVariantCounts: [1, 4],
      providerMode: 'configured',
    },
    permissions: {canEdit: true, canRunGeneration: true, canView: true},
    upload: {
      maxBytes: 10_485_760,
      maxPixels: 20_000_000,
      mimeTypes: ['image/png'],
      rightsStatementVersion: 'reference-upload-v1',
    },
  }} as never);
  mockedApi.create.mockResolvedValue({data: {
    activeVersion: null,
    id: 'ref-1',
    status: 'draft',
    version: 1,
  }} as never);
  mockedApi.update.mockResolvedValue({data: {
    activeVersion: null,
    id: 'ref-1',
    status: 'draft',
    version: 2,
  }} as never);
  mockedApi.uploadVersion.mockResolvedValue({data: {
    activeVersion: {id: 'version-1', imageUrl: '/media/reference.png', number: 1},
    referenceId: 'ref-1',
    referenceVersion: 2,
  }} as never);
  mockedApi.applyVariant.mockResolvedValue({data: {
    activeVersion: {id: 'version-2', imageUrl: '/media/generated.png', number: 2},
    referenceId: 'ref-1',
    referenceVersion: 2,
  }} as never);
  mockedApi.enqueueJob.mockResolvedValue({data: {id: 'job-1'}} as never);
  mockedApi.getJob.mockResolvedValue(completedJob());

  let objectUrlSequence = 0;
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: jest.fn(() => {
      objectUrlSequence += 1;
      return `blob:visual-reference-preview-${objectUrlSequence}`;
    }),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: jest.fn(),
  });
});

test('opens as a location editor and delays required errors until submit', async () => {
  renderPage();

  expect(screen.getByLabelText('Название визуальной опоры')).toBeInTheDocument();
  expect(screen.queryByText('Укажите название опоры')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name: 'Создать опору'})).not.toBeInTheDocument();

  await waitFor(() => expect(
    screen.getByRole('button', {name: 'Сохранить'}),
  ).toBeEnabled());
  fireEvent.click(screen.getByRole('button', {name: 'Сохранить'}));

  expect(await screen.findAllByText('Укажите название опоры')).not.toHaveLength(0);
  expect(mockedApi.create).not.toHaveBeenCalled();
});

test('renders one empty image drafts section inside the inspector', async () => {
  const {container} = renderPage();
  await waitForEditor();

  const prompt = screen.getByPlaceholderText(promptPlaceholder);
  const promptEditor = prompt.closest('.visual-reference-prompt-editor');

  expect(promptEditor).not.toBeNull();
  expect(prompt.closest('.visual-reference-inspector')).toBeNull();
  expect(prompt).toHaveClass('visual-reference-prompt-editor__input');
  expect(prompt).not.toHaveAttribute('rows');
  expect(screen.getByText('Промпт')).toHaveClass('visual-reference-prompt-editor__label');
  expect(screen.getByRole('button', {name: 'Сгенерировать'})).toBeDisabled();
  expect(promptEditor?.nextElementSibling).toBeNull();
  expect(screen.getByText('Черновиков пока нет').closest(
    '.visual-reference-inspector',
  )).not.toBeNull();
  expect(container.querySelectorAll('.visual-reference-inspector__drafts')).toHaveLength(1);
  expect(container.querySelector('.visual-reference-drafts__count')).toHaveTextContent('0');
  expect(screen.queryByText('Создать вариант')).not.toBeInTheDocument();
});

test('opens the color picker without adding the previous color', async () => {
  renderPage();
  fireEvent.click(screen.getByRole('tab', {name: 'Внешний вид'}));

  const addColor = screen.getByRole('button', {name: 'Добавить цвет'});
  await waitFor(() => expect(addColor).toBeEnabled());
  fireEvent.click(addColor);

  await waitFor(() => expect(
    document.querySelector('.visual-reference-color-popup'),
  ).not.toBeNull());
  expect(screen.queryByRole('button', {name: /Удалить цвет/})).not.toBeInTheDocument();
});

test('file picker opens only from an explicitly named upload action', async () => {
  const {container} = renderPage();
  await waitForEditor();
  fillGenerationFields();
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).not.toBeNull();
  const clickPicker = jest.spyOn(input as HTMLInputElement, 'click');

  await generatePreview();
  expect(clickPicker).not.toHaveBeenCalled();
  await addCurrentPreview();
  expect(clickPicker).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', {name: 'Загрузить изображение'}));
  expect(clickPicker).toHaveBeenCalledTimes(1);
});

test('previews and persists an uploaded image without adding it to generated drafts', async () => {
  const {container} = renderPage();
  await waitForEditor();
  fireEvent.change(screen.getByLabelText('Название визуальной опоры'), {
    target: {value: 'Квартира Анны'},
  });
  const file = new File(['image'], 'anna-apartment.png', {type: 'image/png'});
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  fireEvent.change(input as HTMLInputElement, {target: {files: [file]}});

  expect(screen.getByRole('img', {name: 'anna-apartment.png'})).toHaveAttribute(
    'src',
    'blob:visual-reference-preview-1',
  );
  expect(screen.getByText('Черновиков пока нет')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Сохранить'}));

  expect(await screen.findByText('reference editor')).toBeInTheDocument();
  expect(mockedApi.uploadVersion).toHaveBeenCalledWith(
    '7',
    'ref-1',
    file,
    1,
    'reference-upload-v1',
    expect.any(AbortSignal),
  );
});

test('replaces the uploaded preview without creating an image draft', async () => {
  const {container} = renderPage();
  await waitForEditor();
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  const firstFile = new File(['first'], 'first.png', {type: 'image/png'});
  const replacementFile = new File(['replacement'], 'replacement.png', {type: 'image/png'});
  fireEvent.change(input as HTMLInputElement, {target: {files: [firstFile]}});

  fireEvent.click(screen.getByRole('button', {name: 'Заменить изображение'}));
  fireEvent.change(input as HTMLInputElement, {target: {files: [replacementFile]}});

  expect(screen.queryByRole('img', {name: 'first.png'})).not.toBeInTheDocument();
  expect(screen.getByRole('img', {name: 'replacement.png'})).toHaveAttribute(
    'src',
    'blob:visual-reference-preview-2',
  );
  expect(screen.getByText('Черновиков пока нет')).toBeInTheDocument();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:visual-reference-preview-1');
});

test('shows a generated result as unsaved preview before adding it to drafts', async () => {
  renderPage();
  await waitForEditor();
  fillGenerationFields();

  await generatePreview();

  expect(screen.getByText('Результат ещё не сохранён')).toBeInTheDocument();
  expect(screen.getByText('Черновиков пока нет')).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Добавить в черновики'})).toBeEnabled();
  expect(screen.getByLabelText('Название визуальной опоры')).toBeInTheDocument();
  expect(mockedApi.enqueueJob).toHaveBeenCalledWith(
    '7',
    'ref-1',
    expect.objectContaining({expectedReferenceVersion: 1, operation: 'generate', variantCount: 1}),
    'reference:test-generation',
  );
  expect(mockedApi.getJob).toHaveBeenCalledWith(
    '7',
    'ref-1',
    'job-1',
    expect.any(AbortSignal),
  );
});

test('adds one generated result once and keeps primary selection separate', async () => {
  renderPage();
  await waitForEditor();
  fillGenerationFields();
  await generatePreview();

  const addButton = screen.getByRole('button', {name: 'Добавить в черновики'});
  fireEvent.click(addButton);
  fireEvent.click(addButton);
  await waitFor(() => expect(
    screen.getAllByRole('button', {name: 'Черновик 1: Сгенерированное изображение 1'}),
  ).toHaveLength(1));
  expect(document.querySelector('.visual-reference-drafts__count')).toHaveTextContent('1');
  expect(screen.getByRole('button', {
    name: 'Черновик 1: Сгенерированное изображение 1',
  }).closest('.visual-reference-inspector')).not.toBeNull();
  expect(screen.queryByText('Результат ещё не сохранён')).not.toBeInTheDocument();
  expect(screen.queryByText('Основная')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', {
    name: 'Действия с черновиком «Сгенерированное изображение 1»',
  }));
  fireEvent.click(await screen.findByRole('menuitem', {name: 'Сделать основной версией'}));
  expect(screen.getByText('Основная')).toBeInTheDocument();
});

test('keeps earlier drafts while generating and saving another result', async () => {
  mockedApi.enqueueJob
    .mockResolvedValueOnce({data: {id: 'job-1'}} as never)
    .mockResolvedValueOnce({data: {id: 'job-2'}} as never);
  mockedApi.getJob.mockImplementation((_projectId, _referenceId, jobId) => (
    Promise.resolve(jobId === 'job-1'
      ? completedJob('job-1', 'generated-1', 1)
      : completedJob('job-2', 'generated-2', 2))
  ));
  renderPage();
  await waitForEditor();
  fillGenerationFields();
  await generatePreview();
  await addCurrentPreview();

  fireEvent.change(screen.getByPlaceholderText(promptPlaceholder), {
    target: {value: 'Та же квартира утром, холодный рассеянный свет'},
  });
  await generatePreview('Сгенерированное изображение 2');
  expect(screen.getByRole('button', {
    name: 'Черновик 1: Сгенерированное изображение 1',
  })).toBeInTheDocument();
  await addCurrentPreview();

  expect(screen.getByRole('button', {
    name: 'Черновик 1: Сгенерированное изображение 1',
  })).toBeInTheDocument();
  expect(screen.getByRole('button', {
    name: 'Черновик 2: Сгенерированное изображение 2',
  })).toBeInTheDocument();
});

test('selecting a draft changes the canvas but does not make it primary', async () => {
  mockedApi.enqueueJob
    .mockResolvedValueOnce({data: {id: 'job-1'}} as never)
    .mockResolvedValueOnce({data: {id: 'job-2'}} as never);
  mockedApi.getJob.mockImplementation((_projectId, _referenceId, jobId) => (
    Promise.resolve(jobId === 'job-1'
      ? completedJob('job-1', 'generated-1', 1)
      : completedJob('job-2', 'generated-2', 2))
  ));
  renderPage();
  await waitForEditor();
  fillGenerationFields();
  await generatePreview();
  await addCurrentPreview();
  await generatePreview('Сгенерированное изображение 2');
  await addCurrentPreview();

  fireEvent.click(screen.getByRole('button', {
    name: 'Черновик 1: Сгенерированное изображение 1',
  }));
  expect(screen.getByRole('img', {name: 'Сгенерированное изображение 1'})).toHaveAttribute(
    'src',
    'https://cdn.example/generated-1.png',
  );
  expect(screen.queryByText('Основная версия')).not.toBeInTheDocument();
});

test('deleting the active primary draft preserves a valid remaining selection', async () => {
  mockedApi.enqueueJob
    .mockResolvedValueOnce({data: {id: 'job-1'}} as never)
    .mockResolvedValueOnce({data: {id: 'job-2'}} as never);
  mockedApi.getJob.mockImplementation((_projectId, _referenceId, jobId) => (
    Promise.resolve(jobId === 'job-1'
      ? completedJob('job-1', 'generated-1', 1)
      : completedJob('job-2', 'generated-2', 2))
  ));
  renderPage();
  await waitForEditor();
  fillGenerationFields();
  await generatePreview();
  await addCurrentPreview();
  await generatePreview('Сгенерированное изображение 2');
  await addCurrentPreview();
  fireEvent.click(screen.getByRole('button', {name: 'Сделать основной версией'}));

  fireEvent.click(screen.getByRole('button', {
    name: 'Действия с черновиком «Сгенерированное изображение 2»',
  }));
  fireEvent.click(await screen.findByRole('menuitem', {name: 'Удалить из черновиков'}));
  fireEvent.click(await screen.findByRole('button', {name: 'Удалить'}));

  await waitFor(() => expect(screen.queryByRole('button', {
    name: 'Черновик 2: Сгенерированное изображение 2',
  })).not.toBeInTheDocument());
  expect(screen.getByRole('img', {name: 'Сгенерированное изображение 1'})).toBeInTheDocument();
  expect(screen.queryByText('Основная')).not.toBeInTheDocument();
});

test('drafts survive inspector tab switches and selected primary is applied on save', async () => {
  renderPage();
  await waitForEditor();
  fillGenerationFields();
  await generatePreview();
  await addCurrentPreview();
  fireEvent.click(screen.getByRole('button', {name: 'Сделать основной версией'}));

  fireEvent.click(screen.getByRole('tab', {name: 'Внешний вид'}));
  fireEvent.click(screen.getByRole('tab', {name: 'Основное'}));
  expect(screen.getByRole('button', {
    name: 'Черновик 1: Сгенерированное изображение 1',
  })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', {name: 'Сохранить'}));
  expect(await screen.findByText('reference editor')).toBeInTheDocument();
  expect(mockedApi.applyVariant).toHaveBeenCalledWith(
    '7',
    'ref-1',
    'job-1',
    'generated-1',
    1,
  );
});

test('resets editor state when the create route changes to another project', async () => {
  renderPage();
  await waitForEditor();
  fireEvent.change(screen.getByLabelText('Название визуальной опоры'), {
    target: {value: 'Данные первого проекта'},
  });

  fireEvent.click(screen.getByRole('button', {name: 'switch project'}));

  const secondProjectTitle = await screen.findByLabelText('Название визуальной опоры');
  await waitFor(() => expect(secondProjectTitle).toBeEnabled());
  expect(secondProjectTitle).toHaveValue('');
  expect(mockedApi.getCapabilities).toHaveBeenCalledWith('8', expect.any(AbortSignal));
});

test('does not navigate back when a save request finishes after leaving the editor', async () => {
  let resolveCreate: ((value: unknown) => void) | undefined;
  mockedApi.create.mockImplementation(() => new Promise((resolve) => {
    resolveCreate = resolve;
  }) as never);
  renderPage();
  await waitForEditor();
  fireEvent.change(screen.getByLabelText('Название визуальной опоры'), {
    target: {value: 'Квартира Анны'},
  });
  fireEvent.click(screen.getByRole('button', {name: 'Сохранить'}));
  fireEvent.click(screen.getByRole('button', {name: 'switch project'}));
  await waitForEditor();

  await act(async () => {
    resolveCreate?.({data: {
      activeVersion: null,
      id: 'late-ref',
      status: 'draft',
      version: 1,
    }});
    await Promise.resolve();
  });

  expect(screen.getByLabelText('Название визуальной опоры')).toBeInTheDocument();
  expect(screen.queryByText('reference editor')).not.toBeInTheDocument();
});
