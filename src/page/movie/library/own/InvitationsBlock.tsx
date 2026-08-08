import React, { useEffect, useState } from 'react';
import { Button, message } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import {
  IncomingInvitation,
  acceptInvitation,
  declineInvitation,
  fetchIncomingInvitations,
} from '../../../../api/projects/team';

interface Props {
  onAccepted?: () => void;
}

function expiryLabel(expiresAt: string | null): string {
  if (!expiresAt) return '';
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'истекло';
  const days = Math.floor(ms / (24 * 3600 * 1000));
  if (days >= 1) return `действует ещё ${days} дн.`;
  const hours = Math.max(1, Math.floor(ms / (3600 * 1000)));
  return `действует ещё ${hours} ч.`;
}

/**
 * Compact "Приглашения" section shown above the project grid on My Projects.
 * Renders only when the current user has pending incoming invitations.
 */
const InvitationsBlock: React.FC<Props> = ({ onAccepted }) => {
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
      message.success(`Вы присоединились к проекту «${inv.projectTitle}»`);
      setInvitations((prev) => prev.filter((i) => i.id !== inv.id));
      onAccepted?.();
    } catch {
      message.error('Не удалось принять приглашение');
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
      message.error('Не удалось отклонить приглашение');
    } finally {
      setBusyId(null);
    }
  };

  if (invitations.length === 0) return null;

  return (
    <section className="invitations-block">
      <div className="invitations-block-head">
        <TeamOutlined />
        <span>Приглашения</span>
        <span className="invitations-count">{invitations.length}</span>
      </div>
      <div className="invitations-list">
        {invitations.map((inv) => (
          <div className="invitation-card" key={inv.id}>
            <div className="invitation-info">
              <div className="invitation-title">{inv.projectTitle}</div>
              <div className="invitation-meta">
                <span className="invitation-role">{inv.accessRoleLabel}</span>
                {inv.teamRoleLabel && (
                  <span className="invitation-team-role">· {inv.teamRoleLabel}</span>
                )}
                {inv.invitedByUsername && (
                  <span className="invitation-from">
                    от @{inv.invitedByUsername}
                  </span>
                )}
              </div>
              <div className="invitation-expiry">{expiryLabel(inv.expiresAt)}</div>
            </div>
            <div className="invitation-actions">
              <Button
                size="small"
                type="primary"
                loading={busyId === inv.id}
                onClick={() => handleAccept(inv)}
              >
                Принять
              </Button>
              <Button
                size="small"
                ghost
                disabled={busyId === inv.id}
                onClick={() => handleDecline(inv)}
              >
                Отклонить
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default InvitationsBlock;
