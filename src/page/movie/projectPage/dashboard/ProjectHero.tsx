import React from 'react';
import {
  StarFilled,
  PlayCircleFilled,
  ClockCircleOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type {ProjectMock, ProjectStatusKey} from './mocks';
import StatusDropdown from './StatusDropdown';
import ProjectActionsMenu from './ProjectActionsMenu';

interface Props {
  project: ProjectMock;
  onContinue: () => void;
  onOpenScript: () => void;
  onStatusChange: (next: ProjectStatusKey) => void;
  statusUpdating?: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onLeave?: () => void;
}

const ProjectHero: React.FC<Props> = ({
  project,
  onContinue,
  onOpenScript,
  onStatusChange,
  statusUpdating,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
  onLeave,
}) => {
  const role = project.currentUserRole || 'viewer';
  // Editing the status is part of content-editing — gate on backend permission.
  const canEditStatus = !!project.permissions?.canEdit;
  const statusKey: ProjectStatusKey = project.statusKey || 'in_progress';

  return (
    <section className="proj-hero p-5 sm:p-6">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] gap-6">
        {/* Cover */}
        <div className="proj-hero-cover" style={{ background: project.coverGradient }}>
          <button
            type="button"
            className="proj-hero-cover-play"
            disabled
            title="Превью появится после сборки видео"
            aria-label="Превью пока недоступно"
          >
            <PlayCircleFilled style={{ fontSize: 22 }} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusDropdown
              status={statusKey}
              statusLabel={project.statusLabel}
              disabled={!canEditStatus}
              loading={!!statusUpdating}
              onChange={onStatusChange}
            />
            {project.roleLabel && (
              <span className={`proj-role-pill proj-role-${role}`}>
                {project.roleLabel}
              </span>
            )}
            {project.isTeamProject && (
              <span className="proj-team-pill">
                <TeamOutlined style={{ fontSize: 11 }} />
                Командный проект
              </span>
            )}
          </div>

          <div className="flex items-start gap-3 mt-3">
            <h2 className="text-white text-2xl sm:text-3xl font-bold leading-tight tracking-tight truncate">
              {project.title}
            </h2>
            {project.isFavorite && (
              <StarFilled style={{ color: 'var(--craft-accent)', fontSize: 20, marginTop: 8 }} />
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            {project.genres.map((g) => (
              <span key={g} className="proj-tag">{g}</span>
            ))}
          </div>

          <p className="text-white/70 text-sm leading-relaxed mt-4 max-w-2xl">
            {project.description}
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-white/60 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <ClockCircleOutlined />
              {project.updatedAtLabel}
            </span>
            {project.team.length > 0 && (
              <span className="inline-flex items-center gap-2">
                <TeamOutlined />
                <span>Команда проекта</span>
                <span className="proj-avatar-stack inline-flex">
                  {project.team.map((m) => (
                    <span
                      key={m.id}
                      className="proj-avatar"
                      style={{ background: m.gradient }}
                      title={m.name}
                    >
                      {m.name.charAt(0)}
                    </span>
                  ))}
                  {project.teamExtraCount > 0 && (
                    <span
                      className="proj-avatar"
                      style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}
                    >
                      +{project.teamExtraCount}
                    </span>
                  )}
                </span>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-5">
            <button type="button" className="proj-btn proj-btn-primary" onClick={onContinue}>
              Продолжить
            </button>
            <button type="button" className="proj-btn proj-btn-secondary" onClick={onOpenScript}>
              Открыть сценарий
            </button>
            <ProjectActionsMenu
              status={statusKey}
              permissions={project.permissions}
              onEdit={onEdit}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
              onDelete={onDelete}
              onLeave={onLeave}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProjectHero;
