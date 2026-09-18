import React, { useEffect, useState } from 'react';
import { Button, message } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import {useTranslation} from 'react-i18next';
import {
  IncomingInvitation,
  acceptInvitation,
  declineInvitation,
  fetchIncomingInvitations,
} from '../../../../api/projects/team';

interface Props {
  onAccepted?: () => void;
}

/**
 * Compact "Приглашения" section shown above the project grid on My Projects.
 * Renders only when the current user has pending incoming invitations.
 */
const InvitationsBlock: React.FC<Props> = ({ onAccepted }) => {
  const {t} = useTranslation();
  const [invitations, setInvitations] = useState<IncomingInvitation[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    try {
      setInvitations(await fetchIncomingInvitations());
    } catch {
      setInvitations([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleAccept = async (inv: IncomingInvitation) => {
    setBusyId(inv.id);
    try {
      await acceptInvitation(inv.id);
      message.success(t('project.invitations.joined', {title: inv.projectTitle}));
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
      onAccepted?.();
    } catch {
      message.error(t('project.invitations.errors.accept'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (inv: IncomingInvitation) => {
    setBusyId(inv.id);
    try {
      await declineInvitation(inv.id);
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
    } catch {
      message.error(t('project.invitations.errors.decline'));
    } finally {
      setBusyId(null);
    }
  };

  if (invitations.length === 0) return null;

  return (
    <section className="invitations-block">
      <div className="invitations-block-head">
        <TeamOutlined />
        <span>{t('project.invitations.title')}</span>
        <span className="invitations-count">{invitations.length}</span>
      </div>
      <div className="invitations-list">
        {invitations.map((inv) => (
          <div className="invitation-card" key={inv.id}>
            <div className="invitation-info">
              <div className="invitation-title">{inv.projectTitle}</div>
              <div className="invitation-meta">
                <span className="invitation-role">
                  {t(`project.team.accessRoles.${inv.accessRole}`)}
                </span>
                {inv.teamRoleLabel && (
                  <span className="invitation-team-role">
                    · {inv.teamRole === 'other' && (inv.customTeamRole || inv.teamRoleLabel)
                      ? (inv.customTeamRole || inv.teamRoleLabel)
                      : t(`project.team.professionalRoles.${inv.teamRole || 'other'}`)}
                  </span>
                )}
                {inv.invitedByUsername && (
                  <span className="invitation-from">
                    {t('project.invitations.from', {username: inv.invitedByUsername})}
                  </span>
                )}
              </div>
              <div className="invitation-expiry">
                {(() => {
                  if (!inv.expiresAt) return '';
                  const ms = new Date(inv.expiresAt).getTime() - Date.now();
                  if (ms <= 0) return t('project.invitations.expired');
                  const days = Math.floor(ms / (24 * 3600 * 1000));
                  if (days >= 1) return t('project.invitations.expiresInDays', {count: days});
                  const hours = Math.max(1, Math.floor(ms / (3600 * 1000)));
                  return t('project.invitations.expiresInHours', {count: hours});
                })()}
              </div>
            </div>
            <div className="invitation-actions">
              <Button
                size="small"
                type="primary"
                loading={busyId === inv.id}
                onClick={() => handleAccept(inv)}
              >
                {t('project.invitations.accept')}
              </Button>
              <Button
                size="small"
                ghost
                disabled={busyId === inv.id}
                onClick={() => handleDecline(inv)}
              >
                {t('project.invitations.decline')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default InvitationsBlock;
