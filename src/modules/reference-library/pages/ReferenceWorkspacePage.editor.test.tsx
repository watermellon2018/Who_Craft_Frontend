import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {message} from 'antd';
import React from 'react';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';

import {newReferenceIdempotencyKey, referenceApi} from '../api/referenceApi';
import {useReferenceGenerationJob} from '../hooks/useReferenceGenerationJob';
import ReferenceWorkspacePage from './ReferenceWorkspacePage';

jest.mock('../api/referenceApi');
jest.mock('../../credits/components/GenerationCostGuard', () => ({
  GenerationCostPreview: () => null,
  runGenerationWithCredits: (
    intent: {modelKey?: string},
    operation: (estimate: unknown) => unknown,
  ) => operation({modelKey: intent.modelKey ?? 'gemini-flash-image', routingMode: 'manual'}),
}));
jest.mock('../components/ReferenceLibraryShell', () => ({
  __esModule: true,
  default: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));
jest.mock('../hooks/useReferenceGenerationJob');
jest.mock('../../../utils/useUnsavedChangesGuard', () => ({
  useUnsavedChangesGuard: () => ({allowNextNavigation: jest.fn()}),
}));

const mockedApi = referenceApi as jest.Mocked<typeof referenceApi>;
const mockedIdempotencyKey = newReferenceIdempotencyKey as jest.MockedFunction<
  typeof newReferenceIdempotencyKey
>;
const mockedGeneration = useReferenceGenerationJob as jest.MockedFunction<
  typeof useReferenceGenerationJob
>;
const messageSuccess = jest.spyOn(message, 'success').mockImplementation(() => undefined as never);

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

async function renderEditor(initialEntry = '/project/7/references/ref-location/edit') {
  let result: ReturnType<typeof render> | undefined;
  await act(async () => {
    result = render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/project/:projectId/references/:referenceId/edit"
            element={<><ReferenceWorkspacePage /><LocationProbe /></>}
          />
          <Route
            path="/project/:projectId/references/:referenceId/jobs/:jobId"
            element={<><ReferenceWorkspacePage /><LocationProbe /></>}
          />
          <Route
            path="/project/:projectId/references/:referenceId"
            element={<><ReferenceWorkspacePage /><LocationProbe /></>}
          />
          <Route path="/project/:projectId/references" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
  });
  if (!result) throw new Error('Expected the reference editor to render');
  return result;
}

const reference = {
  activeVersion: {
    id: 'version-2',
    imageUrl: '/media/location-v2.png',
    number: 2,
    origin: 'generated',
    thumbnailUrl: '/media/location-v2-thumb.png',
  },
  brief: {
    aspectRatio: '16:9',
    condition: 'Старинное',
    continuityNotes: 'Тёплый свет вечером',
    dimensions: '6 × 4 м',
    distinctiveFeatures: ['витражи'],
    materials: ['кирпич'],
    palette: ['#8b5e3c'],
    schemaVersion: 'reference_brief.v1',
  },
  category: 'location',
  categoryLabel: 'Локация',
  characterLinks: [],
  description: 'Старая мастерская художника',
  id: 'ref-location',
  locationId: null,
  status: 'ready',
  tags: ['интерьер'],
  title: 'Мастерская художника',
  updatedAt: '2026-08-10T10:00:00Z',
  usage: {characters: [], sceneCount: 0},
  version: 4,
} as const;

const versions = [
  {
    createdAt: '2026-08-09T10:00:00Z',
    id: 'version-1',
    imageUrl: '/media/location-v1.png',
    number: 1,
    origin: 'upload',
    thumbnailUrl: '/media/location-v1-thumb.png',
  },
  reference.activeVersion,
];

beforeEach(() => {
  jest.clearAllMocks();
  messageSuccess.mockImplementation(() => undefined as never);
  mockedIdempotencyKey.mockReturnValue('reference:edit-location');
  mockedGeneration.mockReturnValue({
    errorCode: null,
    errorMessage: null,
    isTerminal: false,
    job: null,
    loading: false,
    refresh: jest.fn(),
  });
  mockedApi.getCapabilities.mockResolvedValue({data: {
    categories: [{key: 'location', label: 'Локация'}],
    generation: {
      aspectRatios: ['16:9', '4:3'],
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
  mockedApi.getReference.mockResolvedValue({data: reference} as never);
  mockedApi.listVersions.mockResolvedValue({data: {items: versions}} as never);
  mockedApi.update.mockResolvedValue({data: reference} as never);
  mockedApi.enqueueJob.mockResolvedValue({data: {id: 'job-1'}} as never);
  mockedApi.uploadVersion.mockResolvedValue({data: {
    activeVersion: {
      id: 'version-3',
      imageUrl: '/media/location-v3.png',
      number: 3,
      thumbnailUrl: '/media/location-v3-thumb.png',
    },
    referenceId: 'ref-location',
    referenceVersion: 5,
  }} as never);
});

test('renders the compact location editor without archive or binding controls', async () => {
  await renderEditor();

  expect(await screen.findByLabelText('Название визуальной опоры')).toHaveValue(
    'Мастерская художника',
  );
  expect(screen.getByRole('button', {name: 'Назад'})).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Отмена'})).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Сохранить'})).toBeDisabled();
  expect(screen.getByRole('button', {name: 'Сгенерировать ещё'})).toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Загрузить изображение'})).toBeInTheDocument();
  expect(screen.getByRole('tab', {name: 'Основное'})).toBeInTheDocument();
  expect(screen.getByRole('tab', {name: 'Внешний вид'})).toBeInTheDocument();
  expect(screen.queryByRole('tab', {name: 'Привязка'})).not.toBeInTheDocument();
  expect(screen.queryByText('Архивировать')).not.toBeInTheDocument();
  expect(screen.queryByText('Готово')).not.toBeInTheDocument();
  expect(screen.getByRole('combobox', {name: 'Тип'})).toBeInTheDocument();
  expect(screen.getAllByText('История версий')).toHaveLength(1);
  expect(screen.getByRole('img', {name: /Основное изображение опоры/})).toHaveAttribute(
    'src',
    expect.stringContaining('/media/location-v2.png'),
  );
});

test('switches the large preview without resetting form values or saving', async () => {
  await renderEditor();
  const titleInput = await screen.findByLabelText('Название визуальной опоры');
  fireEvent.change(titleInput, {target: {value: 'Новая мастерская'}});
  fireEvent.change(screen.getByLabelText('Описание'), {
    target: {value: 'Обновлённое описание'},
  });

  fireEvent.click(screen.getByRole('button', {name: 'v1 · Загружено'}));
  expect(screen.getByRole('img', {name: /Основное изображение опоры/})).toHaveAttribute(
    'src',
    expect.stringContaining('/media/location-v1.png'),
  );
  expect(mockedApi.update).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('tab', {name: 'Внешний вид'}));
  expect(await screen.findByText('Цветовая палитра')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', {name: 'Основное'}));
  expect(screen.getByLabelText('Название визуальной опоры')).toHaveValue('Новая мастерская');
  expect(screen.getByLabelText('Описание')).toHaveValue('Обновлённое описание');

  await act(async () => {
    fireEvent.click(screen.getByRole('button', {name: 'Сохранить'}));
  });
  await waitFor(() => expect(mockedApi.update).toHaveBeenCalledWith(
    '7',
    'ref-location',
    expect.objectContaining({title: 'Новая мастерская', version: 4}),
  ));
  await waitFor(() => expect(screen.getByRole('button', {name: 'Сохранить'})).toBeDisabled());
});

test('opens the file picker only from the upload action and reuses generation navigation', async () => {
  const inputClick = jest.spyOn(HTMLInputElement.prototype, 'click');
  const {container} = await renderEditor();
  await screen.findByLabelText('Название визуальной опоры');

  fireEvent.click(screen.getByRole('button', {name: 'v1 · Загружено'}));
  expect(inputClick).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', {name: 'Загрузить изображение'}));
  expect(inputClick).toHaveBeenCalledTimes(1);

  const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!fileInput) throw new Error('Expected the editor upload input to be rendered');
  fireEvent.change(fileInput, {
    target: {files: [new File(['image'], 'location.png', {type: 'image/png'})]},
  });
  expect(mockedApi.uploadVersion).not.toHaveBeenCalled();

  const confirmUploadButton = screen.getByRole('button', {
    name: 'Загрузить и сделать основной версией',
  });
  expect(confirmUploadButton).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', {
    name: 'Я подтверждаю право использовать и хранить это изображение в проекте',
  }));
  expect(confirmUploadButton).toBeEnabled();
  await act(async () => {
    fireEvent.click(confirmUploadButton);
  });
  await waitFor(() => expect(mockedApi.uploadVersion).toHaveBeenCalledWith(
    '7',
    'ref-location',
    expect.objectContaining({name: 'location.png'}),
    4,
    'reference-upload-v1',
  ));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  await act(async () => {
    fireEvent.click(screen.getByRole('button', {name: 'Сгенерировать ещё'}));
  });
  await waitFor(() => expect(mockedApi.enqueueJob).toHaveBeenCalledWith(
    '7',
    'ref-location',
    expect.objectContaining({operation: 'generate', sourceVersionId: null}),
    'reference:edit-location',
  ));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(
    '/project/7/references/ref-location/jobs/job-1',
  ));
  inputClick.mockRestore();
});

test('resets dirty fields in place when editing is canceled', async () => {
  await renderEditor();
  fireEvent.change(await screen.findByLabelText('Название визуальной опоры'), {
    target: {value: 'Несохранённое название'},
  });

  await act(async () => {
    fireEvent.click(screen.getByRole('button', {name: 'Отмена'}));
  });
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/project/7/references/ref-location/edit',
  );
  expect(screen.getByLabelText('Название визуальной опоры')).toHaveValue('Мастерская художника');
  expect(screen.getByRole('button', {name: 'Сохранить'})).toBeDisabled();
});

test('uses the same main and appearance fields as the create-reference inspector', async () => {
  await renderEditor();
  await screen.findByLabelText('Название визуальной опоры');

  expect(screen.getByRole('combobox', {name: 'Тип'})).toBeInTheDocument();
  expect(screen.getByLabelText('Описание')).toBeInTheDocument();
  expect(screen.queryByLabelText('Теги через запятую')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', {name: 'Внешний вид'}));
  expect(await screen.findByText('Цветовая палитра')).toBeInTheDocument();
  expect(screen.getByLabelText('Освещение, время суток и атмосфера')).toBeInTheDocument();
  expect(screen.queryByLabelText('Материалы через запятую')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Состояние')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Размер и масштаб')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Соотношение сторон')).not.toBeInTheDocument();
});

test('uses the library route for back and shows existing empty states without an image', async () => {
  mockedApi.getReference.mockResolvedValue({data: {
    ...reference,
    activeVersion: null,
    status: 'draft',
  }} as never);
  mockedApi.listVersions.mockResolvedValue({data: {items: []}} as never);
  await renderEditor();

  expect(await screen.findByText('У этой опоры пока нет основной версии')).toBeInTheDocument();
  expect(screen.getByText('Версий пока нет')).toBeInTheDocument();
  expect(screen.queryByRole('img', {name: /Основное изображение опоры/})).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', {name: 'Назад'}));
  expect(await screen.findByTestId('location')).toHaveTextContent('/project/7/references');
});

test('keeps the compact editor on a generation job and shows variants in the single thumbnail list', async () => {
  mockedGeneration.mockReturnValue({
    errorCode: null,
    errorMessage: null,
    isTerminal: true,
    loading: false,
    refresh: jest.fn(),
    job: {
      attempts: 1,
      canCancel: false,
      canRetry: false,
      completedAt: '2026-08-10T12:01:00Z',
      createdAt: '2026-08-10T12:00:00Z',
      error: null,
      id: 'job-1',
      operation: 'generate',
      progress: 100,
      referenceId: 'ref-location',
      stage: 'finalized',
      status: 'completed',
      variantCount: 1,
      variants: [{
        height: 1080,
        id: 'variant-1',
        imageUrl: '/media/generated-variant.png',
        index: 0,
        status: 'generated',
        thumbnailUrl: '/media/generated-variant-thumb.png',
        width: 1920,
      }],
    },
  });

  await renderEditor('/project/7/references/ref-location/jobs/job-1');

  expect(await screen.findByLabelText('Название визуальной опоры')).toHaveValue(
    'Мастерская художника',
  );
  const generatedVariant = await screen.findByRole('button', {name: 'Вариант 1'});
  await waitFor(() => expect(generatedVariant).toHaveAttribute('aria-pressed', 'true'));
  expect(screen.getByRole('img', {name: /Основное изображение опоры/})).toHaveAttribute(
    'src',
    expect.stringContaining('/media/generated-variant.png'),
  );
  expect(screen.getAllByText('История версий')).toHaveLength(1);
  expect(screen.queryByText('Архивировать')).not.toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Сделать основной версией'})).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', {name: 'v1 · Загружено'}));
  expect(screen.getByRole('button', {name: 'v1 · Загружено'})).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(generatedVariant).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByRole('img', {name: /Основное изображение опоры/})).toHaveAttribute(
    'src',
    expect.stringContaining('/media/location-v1.png'),
  );
});

test.each([
  '/project/7/references/ref-location/edit',
  '/project/7/references/ref-location/jobs/job-1',
])('keeps the legacy workspace for non-location references at %s', async (path) => {
  mockedApi.getReference.mockResolvedValue({data: {
    ...reference,
    category: 'prop',
    categoryLabel: 'Предмет',
  }} as never);

  const {container} = await renderEditor(path);

  expect(await screen.findByRole('heading', {name: 'Мастерская художника'})).toBeInTheDocument();
  expect(container.querySelector('main.reference-workspace')).toBeInTheDocument();
  expect(container.querySelector('.visual-reference-edit-page')).not.toBeInTheDocument();
  expect(screen.queryByRole('tab', {name: 'Основное'})).not.toBeInTheDocument();
});
