import React from 'react';
import {fireEvent, render, screen, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import ProjectHero from './ProjectHero';
import ProjectMusic from './ProjectMusic';
import ProjectPipeline from './ProjectPipeline';
import QuickActionsCard from './QuickActionsCard';
import {adaptProject} from './api';
import {musicMock} from './mocks';
import type {DashboardProject, DashboardRoadmap} from './api';

jest.mock('../../../../api/http', () => ({
  backendAssetUrl: (path: string) => 'https://backend.test' + path,
}));

const noop = () => undefined;

test('renders the dashboard cover image and keeps Continue functional', () => {
  const onContinue = jest.fn();
  const project = adaptProject({
    id: 42,
    title: 'Тестовый проект',
    subtitle: 'Страница проекта',
    description: '',
    status: 'in_progress',
    statusLabel: 'В работе',
    coverImageUrl: '/media/project-cover.jpg',
    isFavorite: false,
    updatedAt: null,
    updatedAtLabel: '',
    tags: [],
    teamMembers: [],
    currentUserRole: 'owner',
  } satisfies DashboardProject);
  render(
    <ProjectHero
      project={project}
      onContinue={onContinue}
      onOpenScript={noop}
      onStatusChange={noop}
      onEdit={noop}
      onArchive={noop}
      onUnarchive={noop}
      onDelete={noop}
    />,
  );

  fireEvent.click(screen.getByRole('button', {name: 'Продолжить'}));
  expect(onContinue).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('img', {name: 'Обложка проекта «Тестовый проект»'})).toHaveAttribute(
    'src',
    'https://backend.test/media/project-cover.jpg',
  );
  expect(screen.getByRole('button', {name: 'Превью пока недоступно'})).toBeDisabled();
});

test('compact roadmap links available stages while quick actions keep their permissions', () => {
  const onAction = jest.fn();
  const roadmap: DashboardRoadmap = {
    version: 1,
    nextAction: {stepKey: 'script', actionUrl: '/project/42/script'},
    steps: [
      {
        actionUrl: '/project/42/script',
        availability: 'available',
        blockers: [],
        key: 'script',
        metrics: {scenesReady: 1, scenesTotal: 2},
        optional: false,
        progressPercent: 50,
        state: 'in_progress',
      },
      {
        actionUrl: '/project/42/references',
        availability: 'available',
        blockers: [{code: 'generationFailed', count: 1}],
        key: 'references',
        metrics: {failedReferences: 1, referencesReady: 1, referencesTotal: 2},
        optional: true,
        progressPercent: 50,
        state: 'needs_attention',
      },
      {
        actionUrl: '/project/42/video',
        availability: 'coming_soon',
        blockers: [],
        key: 'video',
        metrics: {shotsReady: 0, shotsTotal: 0},
        optional: false,
        progressPercent: null,
        state: 'not_started',
      },
    ],
  };
  render(
    <MemoryRouter>
      <ProjectPipeline
        roadmap={roadmap}
        roadmapUrl="/projects/42/roadmap"
      />
      <QuickActionsCard
        actions={[
          {key: 'new_scene', label: 'Новая сцена', iconKey: 'newScene', accent: 'blue'},
          {key: 'generate_video', label: 'Генерация видео', iconKey: 'genVideo', accent: 'red'},
        ]}
        onAction={onAction}
        isActionEnabled={(key) => key === 'new_scene'}
      />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('button', {name: 'Новая сцена'}));
  expect(screen.getByRole('link', {name: 'Открыть этап «Сценарий»'}))
    .toHaveAttribute('href', '/project/42/script');
  expect(screen.getByRole('link', {name: 'Открыть roadmap'}))
    .toHaveAttribute('href', '/projects/42/roadmap');
  expect(within(screen.getByRole('link', {name: 'Открыть этап «Визуальная библиотека»'}))
    .queryByText('50%')).not.toBeInTheDocument();
  expect(within(screen.getByRole('link', {name: 'Открыть этап «Визуальная библиотека»'}))
    .queryByText('Готово к следующему шагу')).not.toBeInTheDocument();
  const referenceLink = screen.getByRole('link', {
    name: 'Открыть этап «Визуальная библиотека»',
  });
  expect(referenceLink).not.toHaveTextContent('Требует внимания');
  expect(referenceLink).toHaveAccessibleDescription('Исправьте 1 ошибку генерации.');
  expect(within(referenceLink).getByRole('tooltip')).toHaveTextContent(
    'Исправьте 1 ошибку генерации.',
  );
  expect(screen.getByText('В разработке')).toBeInTheDocument();
  expect(onAction).toHaveBeenCalledWith('new_scene');
  expect(screen.getByRole('button', {name: /Генерация видео/})).toBeDisabled();
});

test('video generation remains actionable and the compact preparation status has its own entry', () => {
  const onAction = jest.fn();
  const onOpenVideoPreparation = jest.fn();
  render(
    <QuickActionsCard
      actions={[
        {key: 'generate_video', label: 'Генерация видео', iconKey: 'genVideo', accent: 'red'},
      ]}
      onAction={onAction}
      isActionEnabled={() => true}
      onOpenVideoPreparation={onOpenVideoPreparation}
      videoPreparation={{ready: false, taskCount: 15}}
      videoPreparationLabel="Подготовка к видео: ⚠ Не готово к видео · 15 задач → Открыть"
    />,
  );

  const generationButton = screen.getByRole('button', {name: 'Генерация видео'});
  expect(generationButton).toBeEnabled();
  fireEvent.click(generationButton);
  expect(onAction).toHaveBeenCalledWith('generate_video');

  fireEvent.click(screen.getByRole('button', {
    name: 'Подготовка к видео: ⚠ Не готово к видео · 15 задач → Открыть',
  }));
  expect(onOpenVideoPreparation).toHaveBeenCalledTimes(1);
});

test('viewer can play and inspect music without seeing generation controls', () => {
  const onOpenTrack = jest.fn();
  const {container} = render(<ProjectMusic tracks={musicMock.slice(0, 1)} onOpenTrack={onOpenTrack} />);

  expect(container.querySelector('.proj-track-play')).toBeEnabled();
  fireEvent.click(container.querySelector('.proj-track-title') as HTMLButtonElement);
  expect(onOpenTrack).toHaveBeenCalledWith('m1');
  expect(container.querySelector('.proj-btn')).not.toBeInTheDocument();
});
