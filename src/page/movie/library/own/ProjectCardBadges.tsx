import React from 'react';
import { TeamOutlined } from '@ant-design/icons';
import {
  AccessRole,
  ACCESS_ROLE_LABELS,
  pluralMembers,
} from '../../../../api/projects/team';
import { ProjectListItem } from '../../../../api/projects/projectList';

const ROLE_BADGE_COLORS: Record<AccessRole, { bg: string; fg: string }> = {
  owner: { bg: 'rgba(250,176,5,0.16)', fg: '#fab005' },
  admin: { bg: 'rgba(139,92,246,0.18)', fg: '#a78bfa' },
  editor: { bg: 'rgba(59,130,246,0.18)', fg: '#60a5fa' },
  viewer: { bg: 'rgba(255,255,255,0.10)', fg: 'rgba(255,255,255,0.78)' },
};

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #fab005, #d97706)',
  'linear-gradient(135deg, #8B5CF6, #4338CA)',
  'linear-gradient(135deg, #22C55E, #047857)',
  'linear-gradient(135deg, #3B82F6, #1E3A8A)',
  'linear-gradient(135deg, #EC4899, #BE185D)',
];

/**
 * Compact team metadata shown on a project card. Visually identical for own and
 * team projects — only the badge text and the "Командный проект" chip differ.
 */
const ProjectCardBadges: React.FC<{ project: ProjectListItem }> = ({ project }) => {
  const role = (project.currentUserRole as AccessRole) || 'viewer';
  const roleColors = ROLE_BADGE_COLORS[role];
  const memberCount = project.memberCount ?? 1;
  const members = (project.teamMembers || []).slice(0, 4);
  const extra = Math.max(0, memberCount - members.length);

  return (
    <div className="proj-card-badges">
      <div className="proj-card-badges-row">
        <span
          className="proj-card-role-badge"
          style={{ background: roleColors.bg, color: roleColors.fg }}
        >
          {ACCESS_ROLE_LABELS[role]}
        </span>
        {project.isTeamProject && (
          <span className="proj-card-team-chip">
            <TeamOutlined style={{ fontSize: 11 }} />
            Командный проект
          </span>
        )}
      </div>
      <div className="proj-card-badges-row">
        <span className="proj-card-member-stack" aria-hidden>
          {members.map((m, i) => (
            <span
              key={m.userId ?? i}
              className="proj-card-avatar"
              style={{ background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length] }}
              title={m.displayName}
            >
              {(m.initials || m.displayName || '?').charAt(0)}
            </span>
          ))}
          {extra > 0 && (
            <span
              className="proj-card-avatar proj-card-avatar-extra"
              title={`Ещё ${extra}`}
            >
              +{extra}
            </span>
          )}
        </span>
        <span className="proj-card-member-count">{pluralMembers(memberCount)}</span>
      </div>
    </div>
  );
};

export default ProjectCardBadges;
