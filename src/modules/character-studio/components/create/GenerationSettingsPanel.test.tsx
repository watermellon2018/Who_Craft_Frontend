import React, {useState} from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {characterApi} from '../../api/characterApi';
import type {ImageModelCatalog} from '../../types/character.types';
import GenerationSettingsPanel, {defaultGenerationOptions} from './GenerationSettingsPanel';

jest.mock('../../api/characterApi');

const mockedApi = characterApi as jest.Mocked<typeof characterApi>;

const catalog: ImageModelCatalog = {
  current: 'openrouter-images:openai/gpt-image-1',
  source: 'default',
  configured: true,
  stored: null,
  available: [
    {
      key: 'openrouter-images:openai/gpt-image-1',
      label: 'GPT Image 1',
      description: 'Точная генерация с поддержкой референса.',
      backend: 'openrouter',
      model_id: 'openrouter/openai/gpt-image-1',
      mode: 'image',
      supports_generate: true,
      supports_edit: true,
      supports_reference: true,
      supported_parameters: {seed: {type: 'range'}},
      input_modalities: ['text', 'image'],
      output_modalities: ['image'],
      default: true,
      configured: true,
      requires_env: ['SECRET_ENV_NAME'],
    },
    {
      key: 'openrouter-images:black-forest-labs/flux.2-pro',
      label: 'FLUX 2 Pro',
      backend: 'openrouter',
      model_id: 'openrouter/black-forest-labs/flux.2-pro',
      mode: 'image',
      supports_generate: true,
      supports_edit: false,
      supports_reference: false,
      supported_parameters: {seed: {type: 'range'}},
      input_modalities: ['text'],
      output_modalities: ['image'],
      default: false,
      configured: true,
      requires_env: [],
    },
    {
      key: 'openrouter-images:bytedance/seedream',
      label: 'Seedream',
      backend: 'openrouter',
      model_id: 'openrouter/bytedance/seedream',
      mode: 'image',
      supports_generate: true,
      supports_edit: true,
      supports_reference: true,
      supported_parameters: {},
      input_modalities: ['text', 'image'],
      output_modalities: ['image'],
      default: false,
      configured: true,
      requires_env: [],
    },
    {
      key: 'openrouter-images:google/gemini-image',
      label: 'Gemini Image',
      backend: 'openrouter',
      model_id: 'openrouter/google/gemini-image',
      mode: 'image',
      supports_generate: true,
      supports_edit: true,
      supports_reference: true,
      supported_parameters: {seed: {type: 'range'}},
      input_modalities: ['text', 'image'],
      output_modalities: ['image'],
      default: false,
      configured: false,
      requires_env: ['ANOTHER_SECRET_ENV_NAME'],
    },
  ],
};

function Harness({
  initialValue,
  operation = 'generate',
}: {
  initialValue?: Partial<typeof defaultGenerationOptions>;
  operation?: 'generate' | 'reference';
}) {
  const [value, setValue] = useState(() => ({...defaultGenerationOptions, ...initialValue}));
  return (
    <>
      <GenerationSettingsPanel
        operation={operation}
        projectId="project-1"
        value={value}
        onChange={setValue}
      />
      <output data-testid="generation-options">{JSON.stringify(value)}</output>
    </>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('keeps Auto available without rendering redundant model details', async () => {
  let resolveCatalog: ((value: {data: ImageModelCatalog}) => void) | undefined;
  mockedApi.getImageModelCatalog.mockReturnValue(new Promise((resolve) => {
    resolveCatalog = resolve;
  }) as never);

  render(<Harness />);

  expect(screen.getByText('Загружаем доступные модели…')).toBeInTheDocument();
  expect(screen.getByRole('checkbox')).toBeDisabled();
  expect(screen.getByText('Авто — настройки проекта')).toBeInTheDocument();
  expect(mockedApi.getImageModelCatalog).toHaveBeenCalledWith('project-1');

  await act(async () => {
    resolveCatalog?.({data: catalog});
  });

  await waitFor(() => expect(screen.getByRole('checkbox')).not.toBeDisabled());
  expect(screen.queryByText('Авто: GPT Image 1')).not.toBeInTheDocument();
  expect(screen.queryByText('Точная генерация с поддержкой референса.')).not.toBeInTheDocument();
  expect(screen.queryByText(
    'Настройте количество вариантов и поведение генерации перед созданием персонажа.',
  )).not.toBeInTheDocument();
  expect(screen.queryByText('SECRET_ENV_NAME')).not.toBeInTheDocument();
});

test('keeps Auto available when the catalog cannot be loaded', async () => {
  mockedApi.getImageModelCatalog.mockRejectedValue(new Error('catalog unavailable'));

  render(<Harness />);

  expect(await screen.findByText(
    'Каталог моделей временно недоступен. Автовыбор продолжит работать.',
  )).toBeInTheDocument();
  expect(screen.getByText('Авто — настройки проекта')).toBeInTheDocument();
});

test('clears a stale locked seed while the catalog is unresolved', async () => {
  mockedApi.getImageModelCatalog.mockReturnValue(new Promise(() => {}) as never);

  render(<Harness initialValue={{lockSeed: true, seed: '184205'}} />);

  expect(screen.getByRole('checkbox')).toBeDisabled();
  expect(screen.getByText('Seed будет доступен после загрузки каталога моделей.')).toBeInTheDocument();
  await waitFor(() => {
    expect(screen.getByTestId('generation-options')).toHaveTextContent('"lockSeed":false');
    expect(screen.getByTestId('generation-options')).toHaveTextContent('"seed":""');
  });
});

test('disables seed when Auto resolves to a default model without seed support', async () => {
  mockedApi.getImageModelCatalog.mockResolvedValue({
    data: {...catalog, current: 'openrouter-images:bytedance/seedream'},
  } as never);

  render(<Harness />);

  expect(await screen.findByText('Выбранная модель не поддерживает seed.')).toBeInTheDocument();
  expect(screen.queryByText('Авто: Seedream')).not.toBeInTheDocument();
  expect(screen.getByRole('checkbox')).toBeDisabled();
});

test('disables reference-incompatible and unconfigured models with safe reasons', async () => {
  mockedApi.getImageModelCatalog.mockResolvedValue({data: catalog} as never);
  render(<Harness operation="reference" />);

  fireEvent.mouseDown(screen.getByRole('combobox', {name: 'Модель изображения'}));

  const incompatibleReason = await screen.findByText('Не поддерживает работу с референсом');
  const unconfiguredReason = screen.getByText('Провайдер не настроен');
  expect(incompatibleReason.closest('.ant-select-item-option')).toHaveClass('ant-select-item-option-disabled');
  expect(unconfiguredReason.closest('.ant-select-item-option')).toHaveClass('ant-select-item-option-disabled');
  expect(screen.queryByText('ANOTHER_SECRET_ENV_NAME')).not.toBeInTheDocument();
});

test('selecting a model without seed support clears and disables locked seed', async () => {
  mockedApi.getImageModelCatalog.mockResolvedValue({data: catalog} as never);
  render(<Harness />);

  const seedToggle = screen.getByRole('checkbox');
  await waitFor(() => expect(seedToggle).not.toBeDisabled());
  fireEvent.click(seedToggle);
  expect(seedToggle).toBeChecked();

  fireEvent.mouseDown(screen.getByRole('combobox', {name: 'Модель изображения'}));
  fireEvent.click(await screen.findByText('Seedream'));

  await waitFor(() => expect(screen.getByRole('checkbox')).toBeDisabled());
  expect(screen.getByText('Выбранная модель не поддерживает seed.')).toBeInTheDocument();
  expect(screen.getByTestId('generation-options')).toHaveTextContent(
    '"imageModel":"openrouter-images:bytedance/seedream"',
  );
  expect(screen.getByTestId('generation-options')).toHaveTextContent('"lockSeed":false');
});
