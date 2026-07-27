import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button, Dropdown, Modal, Select, message, Spin, Empty } from 'antd';
import {
  ArrowLeftOutlined,
  MoreOutlined,
  UserAddOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import withAuth from '../../../../utils/auth/check_auth';
import DashboardHeader from '../../../../modules/profile/components/DashboardHeader';
import PathConstants, {projectDashboardPath} from '../../../../routes/pathConstant';
import {
  AccessRole,
  ACCESS_ROLE_LABELS,
  PendingInvitation,
  ProjectPermissions,
  TeamMember,
  TeamSummary,
  cancelInvitation,
  changeMemberAccessRole,
  fetchPendingInvitations,
  fetchTeamSummary,
  pluralMembers,
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

const ASSIGNABLE_ROLES: { value: Exclude<AccessRole, 'owner'>; label: string }[] = [
  { value: 'admin', label: 'Администратор' },
  { value: 'editor', label: 'Редактор' },
  { value: 'viewer', label: 'Наблюдатель' },
];

function joinedLabel(joinedAt?: string | null): string {
  if (!joinedAt) return '';
  try {
    return new Date(joinedAt).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

const ProjectTeamPage: React.FC = () => {
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
      setError('Проект не найден');
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
        setError('Нет доступа к проекту');
        // Access revoked — bounce back to the projects list.
        setTimeout(() => navigate(PathConstants.PROJECTS), 1200);
      } else if (status === 404) {
        setError('Проект не найден');
      } else {
        setError('Не удалось загрузить команду');
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
      message.success('Роль обновлена');
      load();
    } catch (e) {
      const code = teamErrorCode(e);
      message.error(code === 'INSUFFICIENT_PERMISSIONS' ? 'Недостаточно прав' : 'Не удалось изменить роль');
    }
  };

  const handleRemove = (member: TeamMember) => {
    Modal.confirm({
      title: `Удалить участника ${member.displayName}?`,
      content:
        'Доступ будет отозван немедленно. Созданные участником материалы останутся в проекте.',
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await removeMember(projectId!, member.id);
          message.success('Участник удалён');
          load();
        } catch (e) {
          const code = teamErrorCode(e);
          message.error(
            code === 'CANNOT_REMOVE_OWNER'
              ? 'Нельзя удалить владельца'
              : 'Не удалось удалить участника',
          );
          throw e;
        }
      },
    });
  };

  const handleTransfer = (member: TeamMember) => {
    Modal.confirm({
      title: `Передать владение участнику ${member.displayName}?`,
      content:
        'Вы станете администратором, а выбранный участник — владельцем проекта. Это действие нельзя отменить обычным способом.',
      okText: 'Передать владение',
      okButtonProps: {
        style: { background: 'var(--craft-accent)', borderColor: 'var(--craft-accent)', color: '#111827', fontWeight: 700 },
      },
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await transferOwnership(projectId!, member.id);
          message.success('Владение передано');
          load();
        } catch (e) {
          message.error('Не удалось передать владение');
          throw e;
        }
      },
    });
  };

  const handleCancelInvitation = async (inv: PendingInvitation) => {
    try {
      await cancelInvitation(projectId!, inv.id);
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
      message.success('Приглашение отменено');
    } catch {
      message.error('Не удалось отменить приглашение');
    }
  };

  if (loading) {
    return (
      <div className="proj-dash team-page">
        <DashboardHeader sectionTitle="Команда проекта" />
        <main className="app-main profile-scroll team-page-center">
          <Spin size="large" />
        </main>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="proj-dash team-page">
        <DashboardHeader sectionTitle="Команда проекта" />
        <main className="app-main profile-scroll team-page-center">
          <Empty description={error || 'Команда недоступна'} />
        </main>
      </div>
    );
  }

  const canManage = !!perms?.canManageTeam;
  const canTransfer = !!perms?.canTransferOwnership;

  return (
    <div className="proj-dash team-page">
      <DashboardHeader sectionTitle="Команда проекта" />
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
              Назад к проекту
            </Button>
            <div className="team-page-titles">
              <h1 className="team-page-h1">Команда проекта</h1>
              <span className="team-page-subtitle">
                {summary.projectTitle} · {pluralMembers(summary.memberCount)}
              </span>
            </div>
            {canManage && (
              <Button
                type="primary"
                icon={<UserAddOutlined />}
                onClick={() => setInviteOpen(true)}
              >
                Пригласить
              </Button>
            )}
          </div>

          {/* Active members */}
          <section className="team-section">
            <div className="team-section-title">Активные участники</div>
            <div className="team-members-list">
              {summary.members.map((m, i) => {
                const menuItems = [];
                if (canManage && !m.isOwner) {
                  menuItems.push({
                    key: 'remove',
                    danger: true,
                    label: 'Удалить из команды',
                    onClick: () => handleRemove(m),
                  });
                }
                if (canTransfer && !m.isOwner) {
                  menuItems.push({
                    key: 'transfer',
                    label: 'Передать владение',
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
                            title="Владелец"
                          />
                        )}
                      </div>
                      <div className="team-member-sub">
                        <span className="team-member-username">@{m.username}</span>
                        {m.joinedAt && (
                          <span className="team-member-joined">
                            · в команде с {joinedLabel(m.joinedAt)}
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
                          options={ASSIGNABLE_ROLES}
                          style={{ width: 150 }}
                        />
                      ) : (
                        <span className={`team-role-badge team-role-${m.accessRole}`}>
                          {ACCESS_ROLE_LABELS[m.accessRole]}
                        </span>
                      )}
                      {m.teamRoleLabel && (
                        <span className="team-prof-role">{m.teamRoleLabel}</span>
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
                          aria-label="Действия с участником"
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
              <div className="team-section-title">Ожидающие приглашения</div>
              {invitations.length === 0 ? (
                <div className="team-empty">Нет ожидающих приглашений</div>
              ) : (
                <div className="team-invitations-list">
                  {invitations.map((inv) => (
                    <div className="team-invitation-row" key={inv.id}>
                      <div className="team-invitation-info">
                        <div className="team-invitation-target">
                          {inv.invitationType === 'username'
                            ? `@${inv.invitedUsername}`
                            : 'Ссылка-приглашение'}
                        </div>
                        <div className="team-invitation-meta">
                          <span className={`team-role-badge team-role-${inv.accessRole}`}>
                            {inv.accessRoleLabel}
                          </span>
                          {inv.teamRoleLabel && <span>· {inv.teamRoleLabel}</span>}
                          {inv.invitedByUsername && (
                            <span>· создал @{inv.invitedByUsername}</span>
                          )}
                          {inv.expiresAt && (
                            <span>
                              · истекает{' '}
                              {new Date(inv.expiresAt).toLocaleDateString('ru-RU')}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button size="small" danger ghost onClick={() => handleCancelInvitation(inv)}>
                        Отменить
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
