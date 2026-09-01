import {render, screen} from '@testing-library/react';
import React from 'react';

import ProjectProgressCard from './ProjectProgressCard';

const legend = [
  {label: 'Сценарий', value: 80, accent: 'yellow'},
  {label: 'Персонажи', value: null, accent: 'purple'},
  {label: 'Раскадровка', value: 75, accent: 'green'},
  {label: 'Видео', value: 63, accent: 'blue'},
] as const;

it('renders project readiness, N/A characters and stale storyboard details', () => {
  render(
    <ProjectProgressCard
      overall={67}
      legend={[...legend]}
      storyboardNeedsReview={2}
      storyboardReviewScenes={[
        {
          sceneId: 7,
          title: 'Сцена 07 — Ночной рынок',
          currentRevision: 4,
          acceptedRevision: 3,
        },
        {
          sceneId: 12,
          title: 'Сцена 12 — Крыша',
          currentRevision: 2,
          acceptedRevision: 1,
        },
      ]}
    />,
  );

  expect(screen.getByRole('heading', {name: 'Готовность проекта'})).toBeInTheDocument();
  expect(screen.getByText('67%')).toBeInTheDocument();
  expect(screen.getByText('N/A')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', {name: 'Общая готовность проекта'})).toHaveAttribute(
    'aria-valuenow',
    '67',
  );
  expect(screen.getByRole('status')).toHaveTextContent('2 раскадровки требуют проверки');
  expect(screen.getByText('Сцена 07 — Ночной рынок')).toHaveAttribute(
    'title',
    'Подтверждена версия 3, текущая версия 4',
  );
  expect(screen.getByText('Сцена 12 — Крыша')).toBeInTheDocument();
});

it('does not render a storyboard warning when no review is needed', () => {
  render(
    <ProjectProgressCard
      overall={0}
      legend={[...legend]}
      storyboardNeedsReview={0}
      storyboardReviewScenes={[]}
    />,
  );

  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
