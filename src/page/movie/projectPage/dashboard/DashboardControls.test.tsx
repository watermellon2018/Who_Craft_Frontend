import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import ProjectHero from './ProjectHero';
import ProjectMusic from './ProjectMusic';
import ProjectPipeline from './ProjectPipeline';
import QuickActionsCard from './QuickActionsCard';
import {musicMock, pipelineMock, projectMock} from './mocks';

jest.mock('../../../../api/http', () => ({
  backendAssetUrl: (path: string) => 'https://backend.test' + path,
}));

const noop = () => undefined;

test('Continue is functional while project preview is explicitly unavailable', () => {
  const onContinue = jest.fn();
  render(
    <ProjectHero
      project={projectMock}
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
  expect(screen.getByRole('button', {name: 'Превью пока недоступно'})).toBeDisabled();
});

test('pipeline and quick actions enable only implemented destinations', () => {
  const onStep = jest.fn();
  const onAction = jest.fn();
  render(
    <>
      <ProjectPipeline
        pipeline={pipelineMock}
        onStep={onStep}
        isStepEnabled={(key) => key === 'script'}
      />
      <QuickActionsCard
        actions={[
          {key: 'new_scene', label: 'Новая сцена', iconKey: 'newScene', accent: 'blue'},
          {key: 'generate_video', label: 'Генерация видео', iconKey: 'genVideo', accent: 'red'},
        ]}
        onAction={onAction}
        isActionEnabled={(key) => key === 'new_scene'}
      />
    </>,
  );

  fireEvent.click(screen.getByRole('button', {name: /Открыть: Сценарий/}));
  fireEvent.click(screen.getByRole('button', {name: 'Новая сцена'}));
  expect(onStep).toHaveBeenCalledWith('script');
  expect(onAction).toHaveBeenCalledWith('new_scene');
  expect(screen.getByRole('button', {name: /Генерация видео/})).toBeDisabled();
});

test('viewer can play and inspect music without seeing generation controls', () => {
  const onOpenTrack = jest.fn();
  const {container} = render(<ProjectMusic tracks={musicMock.slice(0, 1)} onOpenTrack={onOpenTrack} />);

  expect(container.querySelector('.proj-track-play')).toBeEnabled();
  fireEvent.click(container.querySelector('.proj-track-title') as HTMLButtonElement);
  expect(onOpenTrack).toHaveBeenCalledWith('m1');
  expect(container.querySelector('.proj-btn')).not.toBeInTheDocument();
});