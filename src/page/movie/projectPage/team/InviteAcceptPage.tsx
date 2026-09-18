import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Spin, message } from 'antd';
import {useTranslation} from 'react-i18next';
import withAuth from '../../../../utils/auth/check_auth';
import DashboardHeader from '../../../../modules/profile/components/DashboardHeader';
import PathConstants, {projectDashboardPath} from '../../../../routes/pathConstant';
import api from '../../../../api/http';
import {
  AccessRole,
  acceptInvitationByToken,
  teamErrorCode,
} from '../../../../api/projects/team';
import './team.css';

interface PreviewState {
  projectTitle: string;
  accessRole: AccessRole;
  accessRoleLabel: string;
  teamRole: string;
  teamRoleLabel: string;
  customTeamRole?: string;
  invitedByUsername: string | null;
}

const ERROR_KEYS: Record<string, string> = {
  INVITATION_EXPIRED: 'project.inviteAccept.errors.expired',
  INVITATION_CANCELLED: 'project.inviteAccept.errors.cancelled',
  INVITATION_ALREADY_USED: 'project.inviteAccept.errors.used',
  INVITATION_NOT_FOUND: 'project.inviteAccept.errors.notFound',
  ALREADY_MEMBER: 'project.inviteAccept.errors.alreadyMember',
};

/**
 * Landing page for a shared link invitation (/invite/:token). Previews the
 * project + role, then lets the logged-in user accept (one-time).
 */
const InviteAcceptPage: React.FC = () => {
  const {t} = useTranslation();
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
        if (!cancelled) setError((code && ERROR_KEYS[code]) || 'project.inviteAccept.errors.unavailable');
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
      message.success(t('project.inviteAccept.joined'));
      navigate(projectDashboardPath(projectId));
    } catch (e) {
      const code = teamErrorCode(e);
      if (code === 'ALREADY_MEMBER') {
        message.info(t('project.inviteAccept.errors.alreadyMember'));
        navigate(PathConstants.PROJECTS);
      } else {
        setError((code && ERROR_KEYS[code]) || 'project.inviteAccept.errors.accept');
      }
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="proj-dash team-page">
      <DashboardHeader sectionTitle={t('project.inviteAccept.pageTitle')} />
      <main className="app-main profile-scroll team-page-center">
        <div className="invite-accept-card">
          {loading ? (
            <Spin size="large" />
          ) : error ? (
            <>
              <h2 className="invite-accept-title">{t('project.inviteAccept.unavailableTitle')}</h2>
              <p className="invite-accept-text">{t(error)}</p>
              <Button onClick={() => navigate(PathConstants.PROJECTS)}>
                {t('project.common.backToProjects')}
              </Button>
            </>
          ) : preview ? (
            <>
              <h2 className="invite-accept-title">
                {t('project.inviteAccept.invitedTo', {title: preview.projectTitle})}
              </h2>
              <p className="invite-accept-text">
                {t('project.inviteAccept.role')}: <strong>
                  {t(`project.team.accessRoles.${preview.accessRole}`)}
                </strong>
                {preview.teamRole ? ` · ${preview.teamRole === 'other' && (preview.customTeamRole || preview.teamRoleLabel)
                  ? (preview.customTeamRole || preview.teamRoleLabel)
                  : t(`project.team.professionalRoles.${preview.teamRole || 'other'}`)}` : ''}
                {preview.invitedByUsername
                  ? ` · ${t('project.inviteAccept.from', {username: preview.invitedByUsername})}`
                  : ''}
              </p>
              <div className="invite-accept-actions">
                <Button
                  type="primary"
                  loading={accepting}
                  onClick={accept}
                >
                  {t('project.inviteAccept.join')}
                </Button>
                <Button onClick={() => navigate(PathConstants.PROJECTS)}>
                  {t('project.inviteAccept.notNow')}
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
