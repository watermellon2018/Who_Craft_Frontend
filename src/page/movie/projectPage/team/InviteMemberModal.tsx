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
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    value: 'admin',
    label: 'Администратор',
    description: 'Настройки и команда',
    icon: <SafetyCertificateOutlined />,
  },
  {
    value: 'editor',
    label: 'Редактор',
    description: 'Создание материалов',
    icon: <EditOutlined />,
  },
  {
    value: 'viewer',
    label: 'Наблюдатель',
    description: 'Только просмотр',
    icon: <EyeOutlined />,
  },
];

const ERROR_MESSAGES: Record<string, string> = {
  USER_NOT_FOUND: 'Пользователь с таким именем не найден',
  ALREADY_MEMBER: 'Пользователь уже состоит в команде',
  INVITATION_ALREADY_EXISTS: 'Для этого пользователя уже есть активное приглашение',
  INSUFFICIENT_PERMISSIONS: 'Недостаточно прав для приглашения',
  CANNOT_INVITE_SELF: 'Нельзя пригласить самого себя',
};

const InviteMemberModal: React.FC<Props> = ({
  open,
  projectId,
  teamRoleOptions,
  onClose,
  onInvited,
}) => {
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
        customTeamRole: 'Укажите название профессиональной роли',
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
        username: 'Введите имя пользователя',
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
      message.success(`Приглашение для @${normalizedUsername} отправлено`);
      onInvited();
      handleClose();
    } catch (error) {
      const code = teamErrorCode(error);
      message.error((code && ERROR_MESSAGES[code]) || 'Не удалось отправить приглашение');
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
      message.error((code && ERROR_MESSAGES[code]) || 'Не удалось создать ссылку');
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
      message.error('Не удалось скопировать ссылку');
    }
  };

  const roleSelectors = (
    <>
      <fieldset className="invite-fieldset">
        <legend className="invite-field-heading">
          <span>Права в проекте</span>
          <span className="invite-required-badge">Обязательно</span>
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
                <span className="invite-role-name">{role.label}</span>
                <span className="invite-role-description">{role.description}</span>
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
          <span>Роль в команде</span>
          <span className="invite-optional-badge">Необязательно</span>
        </label>
        <Select
          id="invite-team-role"
          value={teamRole || undefined}
          onChange={(value) => {
            setTeamRole(value || '');
            setErrors((current) => ({...current, customTeamRole: undefined}));
          }}
          placeholder="Например, режиссёр или сценарист"
          allowClear
          options={teamRoleOptions}
          size="large"
          className="invite-select"
          disabled={submitting}
        />
        <span className="invite-field-help">
          Поможет команде сразу понимать, за что отвечает участник.
        </span>
        {teamRole === 'other' && (
          <div className="invite-custom-role">
            <Input
              value={customTeamRole}
              onChange={(event) => {
                setCustomTeamRole(event.target.value);
                setErrors((current) => ({...current, customTeamRole: undefined}));
              }}
              placeholder="Введите название роли"
              maxLength={64}
              size="large"
              status={errors.customTeamRole ? 'error' : undefined}
              aria-label="Название профессиональной роли"
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
      title="Пригласить участника"
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
          <div className="invite-modal-eyebrow">Команда проекта</div>
          <h2 className="invite-modal-title">Пригласить участника</h2>
          <p className="invite-modal-subtitle">
            Выберите способ приглашения и уровень доступа к проекту.
          </p>
        </div>
      </header>

      <div className="invite-modal-body">
        {!createdLink && (
          <div className="invite-methods" role="radiogroup" aria-label="Способ приглашения">
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
                <span className="invite-method-title">По имени</span>
                <span className="invite-method-description">Найдём пользователя Craft</span>
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
                <span className="invite-method-title">По ссылке</span>
                <span className="invite-method-description">Отправьте её в любом мессенджере</span>
              </span>
            </label>
          </div>
        )}

        {createdLink ? (
          <div className="invite-link-result" role="status">
            <span className="invite-success-icon" aria-hidden="true"><CheckOutlined /></span>
            <h3>Ссылка готова</h3>
            <p>Скопируйте её и отправьте будущему участнику команды.</p>
            <div className="invite-link-row">
              <Input
                value={createdLink.inviteUrl}
                readOnly
                size="large"
                aria-label="Ссылка-приглашение"
              />
              <Tooltip title={copied ? 'Скопировано' : 'Скопировать'}>
                <Button
                  type="primary"
                  size="large"
                  icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                  onClick={copyLink}
                  aria-label={copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
                  className="invite-copy-button"
                >
                  {copied ? 'Скопировано' : 'Копировать'}
                </Button>
              </Tooltip>
            </div>
            <div className="invite-security-note">
              <LockOutlined aria-hidden="true" />
              <span>Ссылка одноразовая и перестанет действовать через 5 дней.</span>
            </div>
            <div className="invite-actions invite-result-actions">
              <Button size="large" onClick={handleClose}>Готово</Button>
            </div>
          </div>
        ) : (
          <div className="invite-form">
            {method === 'username' && (
              <div className="invite-field-group invite-username-field">
                <label className="invite-field-heading" htmlFor="invite-username">
                  Имя пользователя
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
                  Используйте имя из профиля — без пробелов.
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
                <span>Создадим защищённую одноразовую ссылку сроком на 5 дней.</span>
              </div>
            )}

            {roleSelectors}

            <footer className="invite-actions">
              <Button size="large" onClick={handleClose} disabled={submitting}>
                Отмена
              </Button>
              <Button
                type="primary"
                size="large"
                loading={submitting}
                onClick={method === 'username' ? handleUsernameInvite : handleLinkInvite}
                className="craft-action-button invite-submit-button"
                icon={method === 'username' ? <UserOutlined /> : <LinkOutlined />}
              >
                {method === 'username' ? 'Отправить приглашение' : 'Создать ссылку'}
              </Button>
            </footer>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default InviteMemberModal;
