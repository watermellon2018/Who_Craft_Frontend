import {
  CheckOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  EditOutlined,
  EyeOutlined,
  LinkOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {Button, Input, message, Modal, Select, Tooltip} from 'antd';
import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';

import {
  createInvitation,
  teamErrorCode,
} from '../../../../api/projects/team';
import type {
  AccessRole,
  PendingInvitation,
} from '../../../../api/projects/team';

interface Props {
  open: boolean;
  projectId: number | string;
  teamRoleOptions: {value: string; label: string}[];
  onClose: () => void;
  onInvited: () => void;
}

type InviteMethod = 'username' | 'link';
type AssignableRole = Exclude<AccessRole, 'owner'>;

interface FormErrors {
  username?: string;
  customTeamRole?: string;
}

const ACCESS_ROLE_OPTIONS: Array<{
  value: AssignableRole;
  labelKey: string;
  descriptionKey: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'admin',
    labelKey: 'project.team.accessRoles.admin',
    descriptionKey: 'project.team.invite.roleDescriptions.admin',
    icon: <SafetyCertificateOutlined />,
  },
  {
    value: 'editor',
    labelKey: 'project.team.accessRoles.editor',
    descriptionKey: 'project.team.invite.roleDescriptions.editor',
    icon: <EditOutlined />,
  },
  {
    value: 'viewer',
    labelKey: 'project.team.accessRoles.viewer',
    descriptionKey: 'project.team.invite.roleDescriptions.viewer',
    icon: <EyeOutlined />,
  },
];

const ERROR_KEYS: Record<string, string> = {
  USER_NOT_FOUND: 'project.team.invite.errors.userNotFound',
  ALREADY_MEMBER: 'project.team.invite.errors.alreadyMember',
  INVITATION_ALREADY_EXISTS: 'project.team.invite.errors.alreadyInvited',
  INSUFFICIENT_PERMISSIONS: 'project.team.invite.errors.forbidden',
  CANNOT_INVITE_SELF: 'project.team.invite.errors.self',
};

const InviteMemberModal: React.FC<Props> = ({
  open,
  projectId,
  teamRoleOptions,
  onClose,
  onInvited,
}) => {
  const {t} = useTranslation();
  const [method, setMethod] = useState<InviteMethod>('username');
  const [username, setUsername] = useState('');
  const [accessRole, setAccessRole] = useState<AssignableRole>('editor');
  const [teamRole, setTeamRole] = useState('');
  const [customTeamRole, setCustomTeamRole] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [createdLink, setCreatedLink] = useState<PendingInvitation | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setUsername('');
    setAccessRole('editor');
    setTeamRole('');
    setCustomTeamRole('');
    setErrors({});
    setCreatedLink(null);
    setCopied(false);
    setMethod('username');
  };

  const handleClose = () => {
    if (createdLink) onInvited();
    reset();
    onClose();
  };

  const changeMethod = (nextMethod: InviteMethod) => {
    setMethod(nextMethod);
    setErrors({});
  };

  const teamRolePayload = () => ({
    team_role: teamRole,
    custom_team_role: teamRole === 'other' ? customTeamRole.trim() : '',
  });

  const validateProfessionalRole = (): boolean => {
    if (teamRole === 'other' && !customTeamRole.trim()) {
      setErrors((current) => ({
        ...current,
        customTeamRole: t('project.team.invite.validation.professionalRole'),
      }));
      return false;
    }
    return true;
  };

  const handleUsernameInvite = async () => {
    const normalizedUsername = username.trim().replace(/^@/, '');
    if (!normalizedUsername) {
      setErrors((current) => ({
        ...current,
        username: t('project.team.invite.validation.username'),
      }));
      return;
    }
    if (!validateProfessionalRole()) return;

    setSubmitting(true);
    try {
      await createInvitation(projectId, {
        invitation_type: 'username',
        username: normalizedUsername,
        access_role: accessRole,
        ...teamRolePayload(),
      });
      message.success(t('project.team.invite.notifications.sent', {username: normalizedUsername}));
      onInvited();
      handleClose();
    } catch (error) {
      const code = teamErrorCode(error);
      message.error(t((code && ERROR_KEYS[code]) || 'project.team.invite.errors.send'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkInvite = async () => {
    if (!validateProfessionalRole()) return;

    setSubmitting(true);
    try {
      const invitation = await createInvitation(projectId, {
        invitation_type: 'link',
        access_role: accessRole,
        ...teamRolePayload(),
      });
      setCreatedLink(invitation);
    } catch (error) {
      const code = teamErrorCode(error);
      message.error(t((code && ERROR_KEYS[code]) || 'project.team.invite.errors.createLink'));
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    if (!createdLink?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(createdLink.inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      message.error(t('project.team.invite.errors.copyLink'));
    }
  };

  const roleSelectors = (
    <>
      <fieldset className="invite-fieldset">
        <legend className="invite-field-heading">
          <span>{t('project.team.invite.accessHeading')}</span>
          <span className="invite-required-badge">{t('project.common.required')}</span>
        </legend>
        <div className="invite-access-roles">
          {ACCESS_ROLE_OPTIONS.map((role) => (
            <button
              key={role.value}
              type="button"
              className={`invite-role-card${accessRole === role.value ? ' is-active' : ''}`}
              aria-pressed={accessRole === role.value}
              onClick={() => setAccessRole(role.value)}
              disabled={submitting}
            >
              <span className="invite-role-icon" aria-hidden="true">{role.icon}</span>
              <span className="invite-role-copy">
                <span className="invite-role-name">{t(role.labelKey)}</span>
                <span className="invite-role-description">{t(role.descriptionKey)}</span>
              </span>
              <span className="invite-role-check" aria-hidden="true">
                <CheckOutlined />
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="invite-field-group">
        <label className="invite-field-heading" htmlFor="invite-team-role">
          <span>{t('project.team.invite.professionalRole')}</span>
          <span className="invite-optional-badge">{t('project.common.optional')}</span>
        </label>
        <Select
          id="invite-team-role"
          value={teamRole || undefined}
          onChange={(value) => {
            setTeamRole(value || '');
            setErrors((current) => ({...current, customTeamRole: undefined}));
          }}
          placeholder={t('project.team.invite.professionalRolePlaceholder')}
          allowClear
          options={teamRoleOptions.map((option) => ({
            value: option.value,
            label: t(`project.team.professionalRoles.${option.value || 'other'}`),
          }))}
          size="large"
          className="invite-select"
          disabled={submitting}
        />
        <span className="invite-field-help">
          {t('project.team.invite.professionalRoleHelp')}
        </span>
        {teamRole === 'other' && (
          <div className="invite-custom-role">
            <Input
              value={customTeamRole}
              onChange={(event) => {
                setCustomTeamRole(event.target.value);
                setErrors((current) => ({...current, customTeamRole: undefined}));
              }}
              placeholder={t('project.team.invite.customRolePlaceholder')}
              maxLength={64}
              size="large"
              status={errors.customTeamRole ? 'error' : undefined}
              aria-label={t('project.team.invite.customRoleAriaLabel')}
              aria-invalid={!!errors.customTeamRole}
              aria-describedby="invite-custom-role-error"
              disabled={submitting}
            />
            {errors.customTeamRole && (
              <span id="invite-custom-role-error" className="invite-field-error" role="alert">
                {errors.customTeamRole}
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      width={720}
      centered
      destroyOnClose
      title={t('project.team.invite.title')}
      closable={!submitting}
      maskClosable={!submitting}
      keyboard={!submitting}
      className="invite-member-modal"
      rootClassName="invite-member-modal-root"
    >
      <header className="invite-modal-hero">
        <span className="invite-modal-icon" aria-hidden="true">
          <TeamOutlined />
        </span>
        <div>
          <div className="invite-modal-eyebrow">{t('project.team.title')}</div>
          <h2 className="invite-modal-title">{t('project.team.invite.title')}</h2>
          <p className="invite-modal-subtitle">
            {t('project.team.invite.subtitle')}
          </p>
        </div>
      </header>

      <div className="invite-modal-body">
        {!createdLink && (
          <div className="invite-methods" role="radiogroup" aria-label={t('project.team.invite.methodLabel')}>
            <label className={`invite-method${method === 'username' ? ' is-active' : ''}`}>
              <input
                type="radio"
                name="invite-method"
                value="username"
                checked={method === 'username'}
                onChange={() => changeMethod('username')}
                disabled={submitting}
                className="invite-method-control"
              />
              <span className="invite-method-icon" aria-hidden="true"><UserOutlined /></span>
              <span>
                <span className="invite-method-title">{t('project.team.invite.byUsername')}</span>
                <span className="invite-method-description">{t('project.team.invite.byUsernameDescription')}</span>
              </span>
            </label>
            <label className={`invite-method${method === 'link' ? ' is-active' : ''}`}>
              <input
                type="radio"
                name="invite-method"
                value="link"
                checked={method === 'link'}
                onChange={() => changeMethod('link')}
                disabled={submitting}
                className="invite-method-control"
              />
              <span className="invite-method-icon" aria-hidden="true"><LinkOutlined /></span>
              <span>
                <span className="invite-method-title">{t('project.team.invite.byLink')}</span>
                <span className="invite-method-description">{t('project.team.invite.byLinkDescription')}</span>
              </span>
            </label>
          </div>
        )}

        {createdLink ? (
          <div className="invite-link-result" role="status">
            <span className="invite-success-icon" aria-hidden="true"><CheckOutlined /></span>
            <h3>{t('project.team.invite.linkReady')}</h3>
            <p>{t('project.team.invite.linkReadyDescription')}</p>
            <div className="invite-link-row">
              <Input
                value={createdLink.inviteUrl}
                readOnly
                size="large"
                aria-label={t('project.team.invite.linkAriaLabel')}
              />
              <Tooltip title={copied ? t('project.common.copied') : t('project.common.copy')}>
                <Button
                  type="primary"
                  size="large"
                  icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                  onClick={copyLink}
                  aria-label={copied ? t('project.team.invite.linkCopied') : t('project.team.invite.copyLink')}
                  className="invite-copy-button"
                >
                  {copied ? t('project.common.copied') : t('project.common.copy')}
                </Button>
              </Tooltip>
            </div>
            <div className="invite-security-note">
              <LockOutlined aria-hidden="true" />
              <span>{t('project.team.invite.linkSecurityNote')}</span>
            </div>
            <div className="invite-actions invite-result-actions">
              <Button size="large" onClick={handleClose}>{t('project.common.done')}</Button>
            </div>
          </div>
        ) : (
          <div className="invite-form">
            {method === 'username' && (
              <div className="invite-field-group invite-username-field">
                <label className="invite-field-heading" htmlFor="invite-username">
                  {t('project.team.invite.username')}
                </label>
                <Input
                  id="invite-username"
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setErrors((current) => ({...current, username: undefined}));
                  }}
                  placeholder="anna_director"
                  prefix={<span className="invite-input-prefix">@</span>}
                  onPressEnter={handleUsernameInvite}
                  autoFocus
                  size="large"
                  status={errors.username ? 'error' : undefined}
                  aria-invalid={!!errors.username}
                  aria-describedby="invite-username-help invite-username-error"
                  disabled={submitting}
                />
                <span id="invite-username-help" className="invite-field-help">
                  {t('project.team.invite.usernameHelp')}
                </span>
                {errors.username && (
                  <span id="invite-username-error" className="invite-field-error" role="alert">
                    {errors.username}
                  </span>
                )}
              </div>
            )}

            {method === 'link' && (
              <div className="invite-link-intro">
                <ClockCircleOutlined aria-hidden="true" />
                <span>{t('project.team.invite.linkIntro')}</span>
              </div>
            )}

            {roleSelectors}

            <footer className="invite-actions">
              <Button size="large" onClick={handleClose} disabled={submitting}>
                {t('project.common.cancel')}
              </Button>
              <Button
                type="primary"
                size="large"
                loading={submitting}
                onClick={method === 'username' ? handleUsernameInvite : handleLinkInvite}
                className="craft-action-button invite-submit-button"
                icon={method === 'username' ? <UserOutlined /> : <LinkOutlined />}
              >
                {method === 'username'
                  ? t('project.team.invite.send')
                  : t('project.team.invite.createLink')}
              </Button>
            </footer>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default InviteMemberModal;
