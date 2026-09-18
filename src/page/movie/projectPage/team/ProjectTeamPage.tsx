import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import { Button, Dropdown, Select, message, Spin, Empty } from 'antd';
import {
  ArrowLeftOutlined,
  MoreOutlined,
  UserAddOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import withAuth from '../../../../utils/auth/check_auth';
import DashboardHeader from '../../../../modules/profile/components/DashboardHeader';
import PathConstants, {projectDashboardPath} from '../../../../routes/pathConstant';
import {craftModal} from '../../../../theme/CraftModalHost';
import {
  AccessRole,
  PendingInvitation,
  ProjectPermissions,
  TeamMember,
  TeamSummary,
  cancelInvitation,
  changeMemberAccessRole,
  fetchPendingInvitations,
  fetchTeamSummary,
  removeMember,
  transferOwnership,
  teamErrorCode,
} from '../../../../api/projects/team';
import InviteMemberModal from './InviteMemberModal';
import './team.css';

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #fab005, #d97706)',
  'linear-gradient(135deg, #8B5CF6, #4338CA)',
  'linear-gradient(135deg, #22C55E, #047857)',
  'linear-gradient(135deg, #3B82F6, #1E3A8A)',
  'linear-gradient(135deg, #EC4899, #BE185D)',
];

const ASSIGNABLE_ROLES: { value: Exclude<AccessRole, 'owner'>; labelKey: string }[] = [
  { value: 'admin', labelKey: 'project.team.accessRoles.admin' },
  { value: 'editor', labelKey: 'project.team.accessRoles.editor' },
  { value: 'viewer', labelKey: 'project.team.accessRoles.viewer' },
];

function joinedLabel(joinedAt: string | null | undefined, locale: string): string {
  if (!joinedAt) return '';
  try {
    return new Date(joinedAt).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

const ProjectTeamPage: React.FC = () => {
  const {t, i18n} = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  // Project id comes from the route param; fall back to router state for
  // consistency with the rest of the app (which passes project_id via state).
  const projectId =
    params.projectId ||
    (location.state as { project_id?: string | number } | null)?.project_id;

  const [summary, setSummary] = useState<TeamSummary | null>(null);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const perms: ProjectPermissions | undefined = summary?.permissions;

  const load = useCallback(async () => {
    if (!projectId) {
      setError('project.team.errors.notFound');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const s = await fetchTeamSummary(projectId);
      setSummary(s);
      if (s.permissions.canManageTeam) {
        try {
          setInvitations(await fetchPendingInvitations(projectId));
        } catch {
          setInvitations([]);
        }
      }
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) {
        setError('project.team.errors.forbidden');
        // Access revoked — bounce back to the projects list.
        setTimeout(() => navigate(PathConstants.PROJECTS), 1200);
      } else if (status === 404) {
        setError('project.team.errors.notFound');
      } else {
        setError('project.team.errors.load');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  const goBack = () => {
    navigate(projectId ? projectDashboardPath(projectId) : PathConstants.PROJECTS);
  };

  const handleRoleChange = async (member: TeamMember, role: Exclude<AccessRole, 'owner'>) => {
    try {
      await changeMemberAccessRole(projectId!, member.id, role);
      message.success(t('project.team.notifications.roleUpdated'));
      load();
    } catch (e) {
      const code = teamErrorCode(e);
      message.error(t(code === 'INSUFFICIENT_PERMISSIONS'
        ? 'project.team.errors.forbiddenAction'
        : 'project.team.errors.changeRole'));
    }
  };

  const handleRemove = (member: TeamMember) => {
    craftModal.confirm({
      title: t('project.team.remove.title', {name: member.displayName}),
      content: t('project.team.remove.description'),
      okText: t('project.team.remove.action'),
      okButtonProps: { danger: true },
      cancelText: t('project.common.cancel'),
      onOk: async () => {
        try {
          await removeMember(projectId!, member.id);
          message.success(t('project.team.notifications.memberRemoved'));
          load();
        } catch (e) {
          const code = teamErrorCode(e);
          message.error(
            code === 'CANNOT_REMOVE_OWNER'
              ? t('project.team.errors.removeOwner')
              : t('project.team.errors.removeMember'),
          );
          throw e;
        }
      },
    });
  };

  const handleTransfer = (member: TeamMember) => {
    craftModal.confirm({
      title: t('project.team.transfer.title', {name: member.displayName}),
      content: t('project.team.transfer.description'),
      okText: t('project.team.transfer.action'),
      okButtonProps: {
        style: { background: 'var(--craft-accent)', borderColor: 'var(--craft-accent)', color: '#111827', fontWeight: 700 },
      },
      cancelText: t('project.common.cancel'),
      onOk: async () => {
        try {
          await transferOwnership(projectId!, member.id);
          message.success(t('project.team.notifications.ownershipTransferred'));
          load();
        } catch (e) {
          message.error(t('project.team.errors.transfer'));
          throw e;
        }
      },
    });
  };

  const handleCancelInvitation = async (inv: PendingInvitation) => {
    try {
      await cancelInvitation(projectId!, inv.id);
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
      message.success(t('project.team.notifications.invitationCancelled'));
    } catch {
      message.error(t('project.team.errors.cancelInvitation'));
    }
  };

  if (loading) {
    return (
      <div className="proj-dash team-page">
        <DashboardHeader sectionTitle={t('project.team.title')} />
        <main className="app-main profile-scroll team-page-center">
          <Spin size="large" />
        </main>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="proj-dash team-page">
        <DashboardHeader sectionTitle={t('project.team.title')} />
        <main className="app-main profile-scroll team-page-center">
          <Empty description={error ? t(error) : t('project.team.errors.unavailable')} />
        </main>
      </div>
    );
  }

  const canManage = !!perms?.canManageTeam;
  const canTransfer = !!perms?.canTransferOwnership;

  return (
    <div className="proj-dash team-page">
      <DashboardHeader sectionTitle={t('project.team.title')} />
      <main className="app-main profile-scroll">
        <div className="team-page-wrap">
          {/* Header */}
          <div className="team-page-head">
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={goBack}
              className="team-back-btn"
            >
              {t('project.team.backToProject')}
            </Button>
            <div className="team-page-titles">
              <h1 className="team-page-h1">{t('project.team.title')}</h1>
              <span className="team-page-subtitle">
                {summary.projectTitle} · {t('project.team.memberCount', {count: summary.memberCount})}
              </span>
            </div>
            {canManage && (
              <Button
                type="primary"
                icon={<UserAddOutlined />}
                onClick={() => setInviteOpen(true)}
                className="craft-action-button team-invite-button"
              >
                {t('project.team.invite.action')}
              </Button>
            )}
          </div>

          {/* Active members */}
          <section className="team-section">
            <div className="team-section-title">{t('project.team.activeMembers')}</div>
            <div className="team-members-list">
              {summary.members.map((m, i) => {
                const menuItems = [];
                if (canManage && !m.isOwner) {
                  menuItems.push({
                    key: 'remove',
                    danger: true,
                    label: t('project.team.remove.menuAction'),
                    onClick: () => handleRemove(m),
                  });
                }
                if (canTransfer && !m.isOwner) {
                  menuItems.push({
                    key: 'transfer',
                    label: t('project.team.transfer.action'),
                    onClick: () => handleTransfer(m),
                  });
                }
                return (
                  <div className="team-member-row" key={m.id}>
                    <span
                      className="team-member-avatar"
                      style={
                        m.avatarUrl
                          ? { backgroundImage: `url(${m.avatarUrl})`, backgroundSize: 'cover' }
                          : { background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length] }
                      }
                    >
                      {!m.avatarUrl && (m.initials || '?')}
                    </span>
                    <div className="team-member-info">
                      <div className="team-member-name">
                        {m.displayName}
                        {m.isOwner && (
                          <CrownOutlined
                            className="team-owner-icon"
                            title={t('project.team.owner')}
                          />
                        )}
                      </div>
                      <div className="team-member-sub">
                        <span className="team-member-username">@{m.username}</span>
                        {m.joinedAt && (
                          <span className="team-member-joined">
                            · {t('project.team.joinedAt', {
                              date: joinedLabel(m.joinedAt, i18n.resolvedLanguage || i18n.language),
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="team-member-roles">
                      {/* Access role: editable for managers on non-owners. */}
                      {canManage && !m.isOwner ? (
                        <Select
                          size="small"
                          value={m.accessRole}
                          onChange={(v) => handleRoleChange(m, v as Exclude<AccessRole, 'owner'>)}
                          options={ASSIGNABLE_ROLES.map((role) => ({
                            value: role.value,
                            label: t(role.labelKey),
                          }))}
                          style={{ width: 150 }}
                        />
                      ) : (
                        <span className={`team-role-badge team-role-${m.accessRole}`}>
                          {t(`project.team.accessRoles.${m.accessRole}`)}
                        </span>
                      )}
                      {m.teamRole && (
                        <span className="team-prof-role">
                          {m.teamRole === 'other' && (m.customTeamRole || m.teamRoleLabel)
                            ? (m.customTeamRole || m.teamRoleLabel)
                            : t(`project.team.professionalRoles.${m.teamRole || 'other'}`)}
                        </span>
                      )}
                    </div>

                    {menuItems.length > 0 && (
                      <Dropdown
                        menu={{ items: menuItems }}
                        trigger={['click']}
                        placement="bottomRight"
                      >
                        <Button
                          type="text"
                          icon={<MoreOutlined />}
                          className="team-member-menu-btn"
                          aria-label={t('project.team.memberActions')}
                        />
                      </Dropdown>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Pending invitations (managers only) */}
          {canManage && (
            <section className="team-section">
              <div className="team-section-title">{t('project.team.pendingInvitations')}</div>
              {invitations.length === 0 ? (
                <div className="team-empty">{t('project.team.noPendingInvitations')}</div>
              ) : (
                <div className="team-invitations-list">
                  {invitations.map((inv) => (
                    <div className="team-invitation-row" key={inv.id}>
                      <div className="team-invitation-info">
                        <div className="team-invitation-target">
                          {inv.invitationType === 'username'
                            ? `@${inv.invitedUsername}`
                            : t('project.team.invite.linkAriaLabel')}
                        </div>
                        <div className="team-invitation-meta">
                          <span className={`team-role-badge team-role-${inv.accessRole}`}>
                            {t(`project.team.accessRoles.${inv.accessRole}`)}
                          </span>
                          {inv.teamRole && (
                            <span>
                              · {inv.teamRole === 'other' && (inv.customTeamRole || inv.teamRoleLabel)
                                ? (inv.customTeamRole || inv.teamRoleLabel)
                                : t(`project.team.professionalRoles.${inv.teamRole || 'other'}`)}
                            </span>
                          )}
                          {inv.invitedByUsername && (
                            <span>· {t('project.team.invitedBy', {username: inv.invitedByUsername})}</span>
                          )}
                          {inv.expiresAt && (
                            <span>
                              · {t('project.team.expiresAt', {
                                date: new Date(inv.expiresAt).toLocaleDateString(
                                  i18n.resolvedLanguage || i18n.language,
                                ),
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button size="small" danger ghost onClick={() => handleCancelInvitation(inv)}>
                        {t('project.common.cancel')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </main>

      <InviteMemberModal
        open={inviteOpen}
        projectId={projectId!}
        teamRoleOptions={summary.teamRoleOptions}
        onClose={() => setInviteOpen(false)}
        onInvited={load}
      />
    </div>
  );
};

export default withAuth(ProjectTeamPage);
