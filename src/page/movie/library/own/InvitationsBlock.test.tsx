import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import React from 'react';

import {
  acceptInvitation,
  declineInvitation,
  fetchIncomingInvitations,
} from '../../../../api/projects/team';
import type {IncomingInvitation} from '../../../../api/projects/team';
import InvitationsBlock from './InvitationsBlock';

jest.mock('../../../../api/projects/team', () => ({
  acceptInvitation: jest.fn(),
  declineInvitation: jest.fn(),
  fetchIncomingInvitations: jest.fn(),
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

const mockedAcceptInvitation = acceptInvitation as jest.MockedFunction<typeof acceptInvitation>;
const mockedDeclineInvitation = declineInvitation as jest.MockedFunction<typeof declineInvitation>;
const mockedFetchIncomingInvitations = fetchIncomingInvitations as jest.MockedFunction<
  typeof fetchIncomingInvitations
>;

const invitation: IncomingInvitation = {
  id: 71,
  projectId: 10,
  projectTitle: 'Визуальная лаборатория',
  invitationType: 'username',
  accessRole: 'editor',
  accessRoleLabel: 'Редактор',
  teamRole: 'director',
  teamRoleLabel: 'Режиссёр',
  invitedByUsername: 'owner',
  createdAt: '2026-08-13T10:00:00Z',
  expiresAt: '2026-08-18T10:00:00Z',
};

describe('InvitationsBlock', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFetchIncomingInvitations.mockResolvedValue([invitation]);
    mockedAcceptInvitation.mockResolvedValue({projectId: invitation.projectId});
    mockedDeclineInvitation.mockResolvedValue(undefined);
  });

  it('shows a username invitation on My Projects and accepts it', async () => {
    const onAccepted = jest.fn();
    render(<InvitationsBlock onAccepted={onAccepted} />);

    expect(await screen.findByText('Визуальная лаборатория')).toBeInTheDocument();
    expect(screen.getByText('Редактор')).toBeInTheDocument();
    expect(screen.getByText('· Режиссёр')).toBeInTheDocument();
    expect(screen.getByText('от @owner')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: 'Принять'}));

    await waitFor(() => {
      expect(mockedAcceptInvitation).toHaveBeenCalledWith(invitation.id);
      expect(onAccepted).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText('Визуальная лаборатория')).not.toBeInTheDocument();
  });
});
