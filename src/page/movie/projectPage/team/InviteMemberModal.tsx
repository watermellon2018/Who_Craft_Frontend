import React, { useState } from 'react';
import {
  Modal,
  Tabs,
  Input,
  Select,
  Button,
  message,
  Tooltip,
} from 'antd';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';
import {
  AccessRole,
  PendingInvitation,
  createInvitation,
  teamErrorCode,
} from '../../../../api/projects/team';

interface Props {
  open: boolean;
  projectId: number | string;
  teamRoleOptions: { value: string; label: string }[];
  onClose: () => void;
  onInvited: () => void;
}

const ACCESS_ROLE_OPTIONS: { value: Exclude<AccessRole, 'owner'>; label: string }[] = [
  { value: 'admin', label: 'Администратор' },
  { value: 'editor', label: 'Редактор' },
  { value: 'viewer', label: 'Наблюдатель' },
];

const ERROR_MESSAGES: Record<string, string> = {
  USER_NOT_FOUND: 'Пользователь с таким username не найден',
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
  const [tab, setTab] = useState<'username' | 'link'>('username');
  const [username, setUsername] = useState('');
  const [accessRole, setAccessRole] = useState<Exclude<AccessRole, 'owner'>>('editor');
  const [teamRole, setTeamRole] = useState<string>('');
  const [customTeamRole, setCustomTeamRole] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdLink, setCreatedLink] = useState<PendingInvitation | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setUsername('');
    setAccessRole('editor');
    setTeamRole('');
    setCustomTeamRole('');
    setCreatedLink(null);
    setCopied(false);
    setTab('username');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const teamRolePayload = () => ({
    team_role: teamRole || '',
    custom_team_role: teamRole === 'other' ? customTeamRole : '',
  });

  const handleUsernameInvite = async () => {
    if (!username.trim()) {
      message.warning('Введите username');
      return;
    }
    if (teamRole === 'other' && !customTeamRole.trim()) {
      message.warning('Укажите название роли для варианта «Другое»');
      return;
    }
    setSubmitting(true);
    try {
      await createInvitation(projectId, {
        invitation_type: 'username',
        username: username.trim(),
        access_role: accessRole,
        ...teamRolePayload(),
      });
      message.success('Приглашение отправлено');
      onInvited();
      handleClose();
    } catch (e) {
      const code = teamErrorCode(e);
      message.error((code && ERROR_MESSAGES[code]) || 'Не удалось отправить приглашение');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkInvite = async () => {
    if (teamRole === 'other' && !customTeamRole.trim()) {
      message.warning('Укажите название роли для варианта «Другое»');
      return;
    }
    setSubmitting(true);
    try {
      const inv = await createInvitation(projectId, {
        invitation_type: 'link',
        access_role: accessRole,
        ...teamRolePayload(),
      });
      setCreatedLink(inv);
      onInvited();
    } catch (e) {
      const code = teamErrorCode(e);
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
      setTimeout(() => setCopied(false), 1500);
    } catch {
      message.error('Не удалось скопировать');
    }
  };

  const roleSelectors = (
    <>
      <label className="invite-field-label">Роль доступа</label>
      <Select
        value={accessRole}
        onChange={(v) => setAccessRole(v)}
        options={ACCESS_ROLE_OPTIONS}
        style={{ width: '100%' }}
      />
      <label className="invite-field-label">Профессиональная роль</label>
      <Select
        value={teamRole || undefined}
        onChange={(v) => setTeamRole(v || '')}
        placeholder="Не указана"
        allowClear
        options={teamRoleOptions}
        style={{ width: '100%' }}
      />
      {teamRole === 'other' && (
        <Input
          value={customTeamRole}
          onChange={(e) => setCustomTeamRole(e.target.value)}
          placeholder="Название роли"
          maxLength={64}
          style={{ marginTop: 8 }}
        />
      )}
    </>
  );

  return (
    <Modal
      open={open}
      title="Пригласить участника"
      onCancel={handleClose}
      footer={null}
      destroyOnClose
    >
      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as 'username' | 'link')}
        items={[
          {
            key: 'username',
            label: 'По username',
            children: (
              <div className="invite-form">
                <label className="invite-field-label">Username</label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="например, anna_director"
                  onPressEnter={handleUsernameInvite}
                  autoFocus
                />
                {roleSelectors}
                <Button
                  type="primary"
                  block
                  loading={submitting}
                  onClick={handleUsernameInvite}
                  style={{ marginTop: 16 }}
                >
                  Отправить приглашение
                </Button>
              </div>
            ),
          },
          {
            key: 'link',
            label: 'По ссылке',
            children: (
              <div className="invite-form">
                {!createdLink ? (
                  <>
                    {roleSelectors}
                    <Button
                      type="primary"
                      block
                      loading={submitting}
                      onClick={handleLinkInvite}
                      style={{ marginTop: 16 }}
                    >
                      Создать ссылку-приглашение
                    </Button>
                  </>
                ) : (
                  <div className="invite-link-result">
                    <div className="invite-link-row">
                      <Input value={createdLink.inviteUrl} readOnly />
                      <Tooltip title={copied ? 'Скопировано' : 'Скопировать'}>
                        <Button
                          icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                          onClick={copyLink}
                        />
                      </Tooltip>
                    </div>
                    <p className="invite-link-hint">
                      Срок действия: 5 дней. Ссылка одноразовая — её можно
                      использовать только один раз.
                    </p>
                    <Button block onClick={handleClose}>
                      Готово
                    </Button>
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
};

export default InviteMemberModal;
