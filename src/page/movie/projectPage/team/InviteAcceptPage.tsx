import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Spin, message } from 'antd';
import withAuth from '../../../../utils/auth/check_auth';
import DashboardHeader from '../../../../modules/profile/components/DashboardHeader';
import PathConstants from '../../../../routes/pathConstant';
import api from '../../../../api/http';
import {
  acceptInvitationByToken,
  teamErrorCode,
} from '../../../../api/projects/team';
import './team.css';

interface PreviewState {
  projectTitle: string;
  accessRoleLabel: string;
  teamRoleLabel: string;
  invitedByUsername: string | null;
}

const ERROR_LABELS: Record<string, string> = {
  INVITATION_EXPIRED: 'Срок действия приглашения истёк.',
  INVITATION_CANCELLED: 'Приглашение было отменено.',
  INVITATION_ALREADY_USED: 'Это приглашение уже использовано.',
  INVITATION_NOT_FOUND: 'Приглашение не найдено.',
  ALREADY_MEMBER: 'Вы уже состоите в команде этого проекта.',
};

/**
 * Landing page for a shared link invitation (/invite/:token). Previews the
 * project + role, then lets the logged-in user accept (one-time).
 */
const InviteAcceptPage: React.FC = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await api.get(`api/invitations/token/${token}/`);
        if (!cancelled) setPreview(res.data);
      } catch (e: any) {
        const code = teamErrorCode(e);
        if (!cancelled) setError((code && ERROR_LABELS[code]) || 'Приглашение недоступно.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const accept = async () => {
    setAccepting(true);
    try {
      const { projectId } = await acceptInvitationByToken(token!);
      message.success('Вы присоединились к проекту');
      navigate(PathConstants.PROJECT_PAGE, { state: { project_id: projectId } });
    } catch (e) {
      const code = teamErrorCode(e);
      if (code === 'ALREADY_MEMBER') {
        message.info('Вы уже в команде этого проекта');
        navigate(PathConstants.PROJECTS);
      } else {
        setError((code && ERROR_LABELS[code]) || 'Не удалось принять приглашение.');
      }
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="proj-dash team-page">
      <DashboardHeader sectionTitle="Приглашение в проект" />
      <main className="app-main profile-scroll team-page-center">
        <div className="invite-accept-card">
          {loading ? (
            <Spin size="large" />
          ) : error ? (
            <>
              <h2 className="invite-accept-title">Приглашение недоступно</h2>
              <p className="invite-accept-text">{error}</p>
              <Button onClick={() => navigate(PathConstants.PROJECTS)}>
                К моим проектам
              </Button>
            </>
          ) : preview ? (
            <>
              <h2 className="invite-accept-title">
                Вас пригласили в проект «{preview.projectTitle}»
              </h2>
              <p className="invite-accept-text">
                Роль: <strong>{preview.accessRoleLabel}</strong>
                {preview.teamRoleLabel ? ` · ${preview.teamRoleLabel}` : ''}
                {preview.invitedByUsername
                  ? ` · от @${preview.invitedByUsername}`
                  : ''}
              </p>
              <div className="invite-accept-actions">
                <Button
                  type="primary"
                  loading={accepting}
                  onClick={accept}
                >
                  Присоединиться
                </Button>
                <Button onClick={() => navigate(PathConstants.PROJECTS)}>
                  Не сейчас
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default withAuth(InviteAcceptPage);
