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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/project/7/references/create?category=location']}>
      <Routes>
        <Route
          path="/project/:projectId/references/create"
          element={<CreateRoute />}
        />
        <Route
          path="/project/:projectId/references/:referenceId/jobs/:jobId"
          element={<div>generation job</div>}
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
  mockedApi.uploadVersion.mockResolvedValue({data: {
    activeVersion: {
      id: 'version-1',
      imageUrl: '/media/reference.png',
      number: 1,
    },
    referenceId: 'ref-1',
    referenceVersion: 2,
  }} as never);
  mockedApi.enqueueJob.mockResolvedValue({data: {id: 'job-1'}} as never);

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

  await waitFor(() => expect(
    screen.getByRole('button', {name: 'Создать опору'}),
  ).toBeEnabled());
  fireEvent.click(screen.getByRole('button', {name: 'Создать опору'}));

  expect(await screen.findAllByText('Укажите название опоры')).not.toHaveLength(0);
  expect(mockedApi.create).not.toHaveBeenCalled();
});

test('renders the generation prompt below the canvas and before variants', () => {
  renderPage();

  const prompt = screen.getByPlaceholderText(
    'Опишите композицию, освещение, материалы, цвета и важные детали изображения',
  );
  const promptEditor = prompt.closest('.visual-reference-prompt-editor');

  expect(promptEditor).not.toBeNull();
  expect(prompt.closest('.visual-reference-inspector')).toBeNull();
  expect(promptEditor?.nextElementSibling).toHaveClass('visual-reference-variants-heading');
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

test('previews and persists an uploaded image with the existing API', async () => {
  const {container} = renderPage();
  await waitFor(() => expect(
    screen.getByLabelText('Название визуальной опоры'),
  ).toBeEnabled());

  fireEvent.change(screen.getByLabelText('Название визуальной опоры'), {
    target: {value: 'Квартира Анны'},
  });
  const file = new File(['image'], 'anna-apartment.png', {type: 'image/png'});
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).not.toBeNull();
  fireEvent.change(input as HTMLInputElement, {target: {files: [file]}});

  expect(screen.getByRole('img', {name: 'anna-apartment.png'})).toHaveAttribute(
    'src',
    'blob:visual-reference-preview-1',
  );
  fireEvent.click(screen.getByRole('checkbox', {
    name: /подтверждаю право использовать и хранить/i,
  }));
  fireEvent.click(screen.getByRole('button', {name: 'Создать опору'}));

  expect(await screen.findByText('reference detail')).toBeInTheDocument();
  expect(mockedApi.create).toHaveBeenCalledWith('7', expect.objectContaining({
    category: 'location',
    title: 'Квартира Анны',
  }));
  expect(mockedApi.uploadVersion).toHaveBeenCalledWith(
    '7',
    'ref-1',
    file,
    1,
    'reference-upload-v1',
    expect.any(AbortSignal),
  );
});

test('replaces the selected local variant instead of retaining the old primary file', async () => {
  const {container} = renderPage();
  await waitFor(() => expect(
    screen.getByLabelText('Название визуальной опоры'),
  ).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Название визуальной опоры'), {
    target: {value: 'Квартира Анны'},
  });
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  const firstFile = new File(['first'], 'first.png', {type: 'image/png'});
  const replacementFile = new File(['replacement'], 'replacement.png', {type: 'image/png'});
  fireEvent.change(input as HTMLInputElement, {target: {files: [firstFile]}});

  fireEvent.click(screen.getByRole('button', {name: /Заменить изображение/}));
  fireEvent.change(input as HTMLInputElement, {target: {files: [replacementFile]}});

  expect(screen.queryByRole('img', {name: 'first.png'})).not.toBeInTheDocument();
  expect(screen.getByRole('img', {name: 'replacement.png'})).toHaveAttribute(
    'src',
    'blob:visual-reference-preview-2',
  );
  expect(screen.getByRole('button', {
    name: 'Вариант 1: replacement.png',
  })).toBeInTheDocument();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:visual-reference-preview-1');

  fireEvent.click(screen.getByRole('checkbox', {
    name: /подтверждаю право использовать и хранить/i,
  }));
  fireEvent.click(screen.getByRole('button', {name: 'Создать опору'}));
  await screen.findByText('reference detail');
  expect(mockedApi.uploadVersion).toHaveBeenCalledWith(
    '7',
    'ref-1',
    replacementFile,
    1,
    'reference-upload-v1',
    expect.any(AbortSignal),
  );
});

test('resets editor state when the create route changes to another project', async () => {
  renderPage();
  await waitFor(() => expect(
    screen.getByLabelText('Название визуальной опоры'),
  ).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Название визуальной опоры'), {
    target: {value: 'Данные первого проекта'},
  });

  fireEvent.click(screen.getByRole('button', {name: 'switch project'}));

  const secondProjectTitle = await screen.findByLabelText('Название визуальной опоры');
  await waitFor(() => expect(secondProjectTitle).toBeEnabled());
  expect(screen.getByLabelText('Название визуальной опоры')).toHaveValue('');
  expect(mockedApi.getCapabilities).toHaveBeenCalledWith('8', expect.any(AbortSignal));
});

test('does not navigate back when a create request finishes after leaving the editor', async () => {
  let resolveCreate: ((value: unknown) => void) | undefined;
  mockedApi.create.mockImplementation(() => new Promise((resolve) => {
    resolveCreate = resolve;
  }) as never);
  renderPage();
  await waitFor(() => expect(
    screen.getByLabelText('Название визуальной опоры'),
  ).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Название визуальной опоры'), {
    target: {value: 'Квартира Анны'},
  });
  fireEvent.click(screen.getByRole('button', {name: 'Создать опору'}));
  fireEvent.click(screen.getByRole('button', {name: 'switch project'}));
  const secondProjectTitle = await screen.findByLabelText('Название визуальной опоры');
  await waitFor(() => expect(secondProjectTitle).toBeEnabled());

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
  expect(screen.queryByText('reference detail')).not.toBeInTheDocument();
});

test('starts real generation through the existing job contract', async () => {
  renderPage();
  await waitFor(() => expect(
    screen.getByLabelText('Название визуальной опоры'),
  ).toBeEnabled());

  fireEvent.change(screen.getByLabelText('Название визуальной опоры'), {
    target: {value: 'Квартира Анны'},
  });
  fireEvent.change(screen.getByPlaceholderText(
    'Опишите композицию, освещение, материалы, цвета и важные детали изображения',
  ), {target: {value: 'Ночная квартира, тёплый практический свет'}});
  fireEvent.click(screen.getAllByRole('button', {name: 'Сгенерировать изображение'})[0]);

  expect(await screen.findByText('generation job')).toBeInTheDocument();
  expect(mockedApi.enqueueJob).toHaveBeenCalledWith(
    '7',
    'ref-1',
    expect.objectContaining({
      expectedReferenceVersion: 1,
      operation: 'generate',
      variantCount: 4,
    }),
    'reference:test-generation',
  );
});
