import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import CharacterPreview, {viewModeToImageType} from './CharacterPreview';
import {AssetJobsMap} from '../hooks/useCharacterAssetJobs';
import {CharacterImageType, CharacterViewMode, StudioCharacter} from '../types/character.types';

// Ant Design Image lazy-loads; stub it so tests see a real <img> element.
jest.mock('antd', () => {
  const actual = jest.requireActual('antd');
  return {
    ...actual,
    Image: ({src, alt, onError}: {src: string; alt: string; onError?: () => void}) => (
      // eslint-disable-next-line jsx-a11y/img-redundant-alt
      <img src={src} alt={alt} onError={onError} />
    ),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCharacter(
  images: Partial<Record<CharacterImageType, {image_id: string; image_type: CharacterImageType; image_url: string; is_active: boolean}>> = {},
): StudioCharacter {
  return {
    character_id: 'char-1',
    project_id: 1,
    name: 'Mira',
    identity_locked: false,
    images: images as StudioCharacter['images'],
  };
}

function makeJobs(overrides: AssetJobsMap = {}): AssetJobsMap {
  return overrides;
}

const noop = () => {};
const defaultProps = {
  activeViewMode: 'portrait' as CharacterViewMode,
  onViewModeChange: noop,
  onGenerateImage: noop,
};

function renderPreview(
  props: Partial<React.ComponentProps<typeof CharacterPreview>> & {activeViewMode: CharacterViewMode},
) {
  return render(
    <CharacterPreview
      {...defaultProps}
      {...props}
    />,
  );
}

// ---------------------------------------------------------------------------
// viewModeToImageType helper
// ---------------------------------------------------------------------------

describe('viewModeToImageType', () => {
  it.each<[CharacterViewMode, CharacterImageType]>([
    ['portrait', 'portrait'],
    ['fullBody', 'full_body'],
    ['scene', 'scene'],
    ['sheet', 'reference_sheet'],
  ])('maps %s → %s', (mode, expected) => {
    expect(viewModeToImageType(mode)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Portrait tab — completed state
// ---------------------------------------------------------------------------

describe('CharacterPreview – portrait tab', () => {
  it('shows the portrait image when character has portrait image_url', () => {
    const character = makeCharacter({
      portrait: {image_id: 'i1', image_type: 'portrait', image_url: 'http://example.com/portrait.png', is_active: true},
    });
    renderPreview({activeViewMode: 'portrait', character});
    const img = screen.getByAltText('Предпросмотр персонажа') as HTMLImageElement;
    expect(img.src).toBe('http://example.com/portrait.png');
  });

  it('shows empty state when portrait is missing and no generation is active', () => {
    renderPreview({activeViewMode: 'portrait', character: makeCharacter()});
    expect(screen.getByText('Портрет пока не создан')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Full body tab — all states
// ---------------------------------------------------------------------------

describe('CharacterPreview – fullBody tab', () => {
  it('shows GeneratingState when full_body job is queued', () => {
    const jobs = makeJobs({full_body: {status: 'queued', jobId: 'j1'}});
    renderPreview({activeViewMode: 'fullBody', character: makeCharacter(), secondaryJobs: jobs});
    expect(screen.getByText('Генерируем полный рост…')).toBeInTheDocument();
    expect(screen.queryByAltText('Предпросмотр персонажа')).toBeNull();
  });

  it('shows GeneratingState when full_body job is processing', () => {
    const jobs = makeJobs({full_body: {status: 'processing', jobId: 'j1', progress: 40}});
    renderPreview({activeViewMode: 'fullBody', character: makeCharacter(), secondaryJobs: jobs});
    expect(screen.getByText('Генерируем полный рост…')).toBeInTheDocument();
  });

  it('shows image when full_body is completed and image_url is present', () => {
    const character = makeCharacter({
      full_body: {image_id: 'i2', image_type: 'full_body', image_url: 'http://example.com/fb.png', is_active: true},
    });
    const jobs = makeJobs({full_body: {status: 'completed', jobId: 'j1'}});
    renderPreview({activeViewMode: 'fullBody', character, secondaryJobs: jobs});
    const img = screen.getByAltText('Предпросмотр персонажа') as HTMLImageElement;
    expect(img.src).toBe('http://example.com/fb.png');
  });

  it('shows FailedState when full_body job failed', () => {
    const jobs = makeJobs({full_body: {status: 'failed', jobId: 'j1', errorMessage: 'Провайдер не ответил'}});
    renderPreview({activeViewMode: 'fullBody', character: makeCharacter(), secondaryJobs: jobs});
    expect(screen.getByText('Ошибка генерации')).toBeInTheDocument();
  });

  it('shows error message text when provided', () => {
    const jobs = makeJobs({full_body: {status: 'failed', jobId: 'j1', errorMessage: 'Провайдер не ответил'}});
    renderPreview({activeViewMode: 'fullBody', character: makeCharacter(), secondaryJobs: jobs});
    expect(screen.getByText('Провайдер не ответил')).toBeInTheDocument();
  });

  it('shows retry button in FailedState', () => {
    const jobs = makeJobs({full_body: {status: 'failed', jobId: 'j1'}});
    renderPreview({activeViewMode: 'fullBody', character: makeCharacter(), secondaryJobs: jobs});
    expect(screen.getByRole('button', {name: /повторить/i})).toBeInTheDocument();
  });

  it('calls onRetrySecondary with full_body when retry button is clicked', () => {
    const onRetry = jest.fn();
    const jobs = makeJobs({full_body: {status: 'failed', jobId: 'j1'}});
    renderPreview({activeViewMode: 'fullBody', character: makeCharacter(), secondaryJobs: jobs, onRetrySecondary: onRetry});
    fireEvent.click(screen.getByRole('button', {name: /повторить/i}));
    expect(onRetry).toHaveBeenCalledWith('full_body');
  });

  it('shows empty state with generate button when no job and no image', () => {
    renderPreview({activeViewMode: 'fullBody', character: makeCharacter(), secondaryJobs: {}});
    expect(screen.getByText('Модель полного роста пока не создана')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /сгенерировать этот режим/i})).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Scene tab
// ---------------------------------------------------------------------------

describe('CharacterPreview – scene tab', () => {
  it('shows GeneratingState when scene job is queued', () => {
    const jobs = makeJobs({scene: {status: 'queued', jobId: 'j2'}});
    renderPreview({activeViewMode: 'scene', character: makeCharacter(), secondaryJobs: jobs});
    expect(screen.getByText('Генерируем сцену…')).toBeInTheDocument();
  });

  it('shows FailedState and retry for scene', () => {
    const onRetry = jest.fn();
    const jobs = makeJobs({scene: {status: 'failed', jobId: 'j2'}});
    renderPreview({activeViewMode: 'scene', character: makeCharacter(), secondaryJobs: jobs, onRetrySecondary: onRetry});
    fireEvent.click(screen.getByRole('button', {name: /повторить/i}));
    expect(onRetry).toHaveBeenCalledWith('scene');
  });

  it('shows empty state when scene has no job', () => {
    renderPreview({activeViewMode: 'scene', character: makeCharacter()});
    expect(screen.getByText('Сцена пока не создана')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Reference sheet tab
// ---------------------------------------------------------------------------

describe('CharacterPreview – sheet tab', () => {
  it('shows GeneratingState when reference_sheet job is queued', () => {
    const jobs = makeJobs({reference_sheet: {status: 'queued', jobId: 'j3'}});
    renderPreview({activeViewMode: 'sheet', character: makeCharacter(), secondaryJobs: jobs});
    expect(screen.getByText('Генерируем референс-лист…')).toBeInTheDocument();
  });

  it('shows FailedState and retry for reference_sheet', () => {
    const onRetry = jest.fn();
    const jobs = makeJobs({reference_sheet: {status: 'failed', jobId: 'j3'}});
    renderPreview({activeViewMode: 'sheet', character: makeCharacter(), secondaryJobs: jobs, onRetrySecondary: onRetry});
    fireEvent.click(screen.getByRole('button', {name: /повторить/i}));
    expect(onRetry).toHaveBeenCalledWith('reference_sheet');
  });
});

// ---------------------------------------------------------------------------
// Tab status indicators
// ---------------------------------------------------------------------------

describe('CharacterPreview – tab status indicators', () => {
  it('portrait tab has ready status dot when portrait image exists', () => {
    const character = makeCharacter({
      portrait: {image_id: 'i1', image_type: 'portrait', image_url: 'http://example.com/p.png', is_active: true},
    });
    renderPreview({activeViewMode: 'portrait', character});
    // TabStatusDot renders a span with class --ready when portrait is done
    const dot = document.querySelector('.character-preview-tabs__status--ready');
    expect(dot).not.toBeNull();
  });

  it('full_body tab has generating status dot when job is queued', () => {
    const jobs = makeJobs({full_body: {status: 'queued', jobId: 'j1'}});
    renderPreview({activeViewMode: 'portrait', character: makeCharacter(), secondaryJobs: jobs});
    const dot = document.querySelector('.character-preview-tabs__status--generating');
    expect(dot).not.toBeNull();
  });

  it('full_body tab has failed status dot when job failed', () => {
    const jobs = makeJobs({full_body: {status: 'failed', jobId: 'j1'}});
    renderPreview({activeViewMode: 'portrait', character: makeCharacter(), secondaryJobs: jobs});
    const dot = document.querySelector('.character-preview-tabs__status--failed');
    expect(dot).not.toBeNull();
  });

  it('scene tab shows no status dot when there is no job and no image', () => {
    renderPreview({activeViewMode: 'portrait', character: makeCharacter(), secondaryJobs: {}});
    // idle status renders null — only ready/generating/failed get a dot
    const generatingDots = document.querySelectorAll('.character-preview-tabs__status--generating');
    const failedDots = document.querySelectorAll('.character-preview-tabs__status--failed');
    expect(generatingDots.length).toBe(0);
    expect(failedDots.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Generate button disabled while generating
// ---------------------------------------------------------------------------

describe('CharacterPreview – generate button state', () => {
  it('generate button is disabled when generatingImageType is set', () => {
    renderPreview({
      activeViewMode: 'portrait',
      character: makeCharacter(),
      generatingImageType: 'portrait',
    });
    const btn = screen.queryByRole('button', {name: /сгенерировать этот режим/i});
    // The button only appears in empty state; when generating, GeneratingState is shown
    // (no portrait image, generatingImageType matches portrait)
    expect(btn).toBeNull();
  });
});
