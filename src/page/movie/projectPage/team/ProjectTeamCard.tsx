import React from 'react';
import { TeamOutlined, UserAddOutlined, RightOutlined } from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import {
  AccessRole,
} from '../../../../api/projects/team';

export interface TeamCardMember {
  userId: number;
  displayName: string;
  initials: string;
  avatarUrl?: string | null;
  role?: string;
}

interface Props {
  members: TeamCardMember[];
  memberCount: number;
  currentUserRole: AccessRole | null;
  ownerName: string | null;
  canManageTeam: boolean;
  onOpenTeam: () => void;
  onInvite?: () => void;
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #fab005, #d97706)',
  'linear-gradient(135deg, #8B5CF6, #4338CA)',
  'linear-gradient(135deg, #22C55E, #047857)',
  'linear-gradient(135deg, #3B82F6, #1E3A8A)',
  'linear-gradient(135deg, #EC4899, #BE185D)',
];

/**
 * Compact "Команда проекта" card for the project page right column. Visible to
 * every member; management actions only render for owner/admin.
 */
const ProjectTeamCard: React.FC<Props> = ({
  members,
  memberCount,
  currentUserRole,
  ownerName,
  canManageTeam,
  onOpenTeam,
  onInvite,
}) => {
  const {t} = useTranslation();
  const shown = members.slice(0, 4);
  const extra = Math.max(0, memberCount - shown.length);
  const roleLabel = currentUserRole ? t(`project.team.accessRoles.${currentUserRole}`) : '';

  return (
    <section className="team-card">
      <div className="team-card-head">
        <div className="team-card-title">
          <TeamOutlined />
          <span>{t('project.team.title')}</span>
        </div>
        {canManageTeam && onInvite && (
          <button
            type="button"
            className="team-card-invite-btn"
            onClick={onInvite}
            aria-label={t('project.team.invite.title')}
            title={t('project.team.invite.title')}
          >
            <UserAddOutlined />
            <span>{t('project.team.invite.action')}</span>
          </button>
        )}
      </div>

      <div className="team-card-avatars">
        <span className="team-card-avatar-stack">
          {shown.map((m, i) => (
            <span
              key={m.userId ?? i}
              className="team-card-avatar"
              style={
                m.avatarUrl
                  ? { backgroundImage: `url(${m.avatarUrl})`, backgroundSize: 'cover' }
                  : { background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length] }
              }
              title={m.displayName}
            >
              {!m.avatarUrl && (m.initials || m.displayName || '?').charAt(0)}
            </span>
          ))}
          {extra > 0 && (
            <span className="team-card-avatar team-card-avatar-extra" title={t('project.common.moreCount', {count: extra})}>
              +{extra}
            </span>
          )}
        </span>
        <span className="team-card-count">{t('project.team.memberCount', {count: memberCount})}</span>
      </div>

      <div className="team-card-meta">
        {roleLabel && (
          <div className="team-card-meta-row">
            <span className="team-card-meta-label">{t('project.team.yourRole')}</span>
            <span className="team-card-meta-value">{roleLabel}</span>
          </div>
        )}
        {ownerName && (
          <div className="team-card-meta-row">
            <span className="team-card-meta-label">{t('project.team.owner')}</span>
            <span className="team-card-meta-value">{ownerName}</span>
          </div>
        )}
      </div>

      <button type="button" className="team-card-open" onClick={onOpenTeam}>
        <span>{t('project.team.allMembers')}</span>
        <RightOutlined style={{ fontSize: 11 }} />
      </button>
    </section>
  );
};

export default ProjectTeamCard;
