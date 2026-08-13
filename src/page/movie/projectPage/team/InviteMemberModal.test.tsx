import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import React from 'react';

import {
  createInvitation,
  teamErrorCode,
} from '../../../../api/projects/team';
import type {PendingInvitation} from '../../../../api/projects/team';
import InviteMemberModal from './InviteMemberModal';

jest.mock('../../../../api/projects/team', () => ({
  createInvitation: jest.fn(),
  teamErrorCode: jest.fn(),
}));

jest.mock('antd', () => {
  const actual = jest.requireActual('antd');
  return {
    ...actual,
    message: {
      error: jest.fn(),
      success: jest.fn(),
    },
  };
});

const mockedCreateInvitation = createInvitation as jest.MockedFunction<typeof createInvitation>;
const mockedTeamErrorCode = teamErrorCode as jest.MockedFunction<typeof teamErrorCode>;

const invitation: PendingInvitation = {
  id: 71,
  invitationType: 'link',
  accessRole: 'viewer',
  accessRoleLabel: 'Наблюдатель',
  teamRole: '',
  teamRoleLabel: '',
  status: 'pending',
  invitedUsername: null,
  invitedByUsername: 'owner',
  createdAt: '2026-08-13T10:00:00Z',
  expiresAt: '2026-08-18T10:00:00Z',
  inviteUrl: 'http://localhost:3000/invite/token-71',
};

const defaultProps = {
  open: true,
  projectId: 71,
  teamRoleOptions: [
    {value: 'director', label: 'Режиссёр'},
    {value: 'other', label: 'Другое'},
  ],
  onClose: jest.fn(),
  onInvited: jest.fn(),
};

describe('InviteMemberModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedTeamErrorCode.mockReturnValue(null);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {writeText: jest.fn().mockResolvedValue(undefined)},
    });
  });

  it('sends a normalized username with the selected access role', async () => {
    mockedCreateInvitation.mockResolvedValue({...invitation, invitationType: 'username'});
    render(<InviteMemberModal {...defaultProps} />);

    expect(screen.getByRole('dialog', {name: 'Пригласить участника'})).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: /администратор/i}));
    fireEvent.change(screen.getByLabelText('Имя пользователя'), {
      target: {value: '  @anna_director  '},
    });
    fireEvent.click(screen.getByRole('button', {name: /отправить приглашение/i}));

    await waitFor(() => {
      expect(mockedCreateInvitation).toHaveBeenCalledWith(71, {
        invitation_type: 'username',
        username: 'anna_director',
        access_role: 'admin',
        team_role: '',
        custom_team_role: '',
      });
      expect(defaultProps.onInvited).toHaveBeenCalledTimes(1);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('shows an inline error when the username is empty', () => {
    render(<InviteMemberModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', {name: /отправить приглашение/i}));

    expect(screen.getByRole('alert')).toHaveTextContent('Введите имя пользователя');
    expect(mockedCreateInvitation).not.toHaveBeenCalled();
  });

  it('creates a one-time link for the selected role and copies it', async () => {
    mockedCreateInvitation.mockResolvedValue(invitation);
    render(<InviteMemberModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('radio', {name: /по ссылке/i}));
    fireEvent.click(screen.getByRole('button', {name: /наблюдатель/i}));
    fireEvent.click(screen.getByRole('button', {name: /создать ссылку/i}));

    expect(await screen.findByText('Ссылка готова')).toBeInTheDocument();
    expect(mockedCreateInvitation).toHaveBeenCalledWith(71, {
      invitation_type: 'link',
      access_role: 'viewer',
      team_role: '',
      custom_team_role: '',
    });

    fireEvent.click(screen.getByRole('button', {name: 'Скопировать ссылку'}));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(invitation.inviteUrl);
      expect(screen.getByRole('button', {name: 'Ссылка скопирована'})).toBeInTheDocument();
    });
    expect(defaultProps.onInvited).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', {name: 'Готово'}));
    expect(defaultProps.onInvited).toHaveBeenCalledTimes(1);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('requires a name when the custom professional role is selected', async () => {
    render(<InviteMemberModal {...defaultProps} />);

    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByTitle('Другое'));
    fireEvent.click(screen.getByRole('button', {name: /отправить приглашение/i}));

    expect(screen.getByRole('alert')).toHaveTextContent('Введите имя пользователя');

    fireEvent.change(screen.getByLabelText('Имя пользователя'), {
      target: {value: 'anna_director'},
    });
    fireEvent.click(screen.getByRole('button', {name: /отправить приглашение/i}));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Укажите название профессиональной роли',
    );
    expect(mockedCreateInvitation).not.toHaveBeenCalled();
  });
});
