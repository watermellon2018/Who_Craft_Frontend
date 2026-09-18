import {getApiErrorCode} from '../errors';
import api from '../http';

// Team-collaboration API client. Token is attached as X-User-Token by http.ts.

export type AccessRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type InvitationType = 'username' | 'link';
export type InvitationStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'expired';

export interface ProjectPermissions {
  currentUserRole: AccessRole | null;
  canView: boolean;
  canEdit: boolean;
  canRunGeneration: boolean;
  canEditSettings: boolean;
  canPublish: boolean;
  canManageTeam: boolean;
  canTransferOwnership: boolean;
  canDeleteProject: boolean;
  canLeaveProject: boolean;
}

export interface TeamMember {
  id: number;
  userId: number;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  initials: string;
  accessRole: AccessRole;
  accessRoleLabel: string;
  teamRole: string;
  teamRoleLabel: string;
  customTeamRole: string;
  isOwner: boolean;
  joinedAt?: string | null;
}

export interface TeamSummary {
  projectId: number;
  projectTitle: string;
  memberCount: number;
  members: TeamMember[];
  ownerUserId: number | null;
  ownerName: string | null;
  currentUserRole: AccessRole | null;
  currentUserRoleLabel: string;
  permissions: ProjectPermissions;
  teamRoleOptions: { value: string; label: string }[];
}

export interface PendingInvitation {
  id: number;
  invitationType: InvitationType;
  accessRole: AccessRole;
  accessRoleLabel: string;
  teamRole: string;
  teamRoleLabel: string;
  customTeamRole?: string;
  status: InvitationStatus;
  invitedUsername: string | null;
  invitedByUsername: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  // Only present in the create response.
  inviteUrl?: string;
  token?: string;
}

export interface IncomingInvitation {
  id: number;
  projectId: number;
  projectTitle: string;
  invitationType: InvitationType;
  accessRole: AccessRole;
  accessRoleLabel: string;
  teamRole: string;
  teamRoleLabel: string;
  customTeamRole?: string;
  invitedByUsername: string | null;
  createdAt: string | null;
  expiresAt: string | null;
}

const base = (projectId: number | string) => `api/projects/${projectId}/team`;

export async function fetchTeamSummary(
  projectId: number | string,
): Promise<TeamSummary> {
  const res = await api.get<TeamSummary>(`${base(projectId)}/`);
  return res.data;
}

export async function fetchMembers(
  projectId: number | string,
): Promise<{ members: TeamMember[]; memberCount: number; permissions: ProjectPermissions }> {
  const res = await api.get(`${base(projectId)}/members/`);
  return res.data;
}

export async function fetchPendingInvitations(
  projectId: number | string,
): Promise<PendingInvitation[]> {
  const res = await api.get(`${base(projectId)}/invitations/`);
  return res.data.invitations as PendingInvitation[];
}

export interface InvitePayload {
  invitation_type: InvitationType;
  username?: string;
  access_role: Exclude<AccessRole, 'owner'>;
  team_role?: string;
  custom_team_role?: string;
}

export async function createInvitation(
  projectId: number | string,
  payload: InvitePayload,
): Promise<PendingInvitation> {
  const res = await api.post<PendingInvitation>(
    `${base(projectId)}/invitations/`,
    payload,
  );
  return res.data;
}

export async function cancelInvitation(
  projectId: number | string,
  invitationId: number,
): Promise<void> {
  await api.delete(`${base(projectId)}/invitations/${invitationId}/`);
}

export async function changeMemberAccessRole(
  projectId: number | string,
  memberId: number,
  accessRole: Exclude<AccessRole, 'owner'>,
): Promise<TeamMember> {
  const res = await api.patch<TeamMember>(
    `${base(projectId)}/members/${memberId}/`,
    { access_role: accessRole },
  );
  return res.data;
}

export async function changeMemberTeamRole(
  projectId: number | string,
  memberId: number,
  teamRole: string,
  customTeamRole = '',
): Promise<TeamMember> {
  const res = await api.patch<TeamMember>(
    `${base(projectId)}/members/${memberId}/`,
    { team_role: teamRole, custom_team_role: customTeamRole },
  );
  return res.data;
}

export async function removeMember(
  projectId: number | string,
  memberId: number,
): Promise<void> {
  await api.delete(`${base(projectId)}/members/${memberId}/`);
}

export async function leaveProject(
  projectId: number | string,
): Promise<void> {
  await api.post(`${base(projectId)}/leave/`, {});
}

export async function transferOwnership(
  projectId: number | string,
  memberId: number,
): Promise<void> {
  await api.post(`${base(projectId)}/transfer-ownership/`, { member_id: memberId });
}

// ---- User-scoped invitations (My Projects page) ----

export async function fetchIncomingInvitations(): Promise<IncomingInvitation[]> {
  const res = await api.get('api/invitations/incoming/');
  return res.data.invitations as IncomingInvitation[];
}

export async function acceptInvitation(invitationId: number): Promise<{ projectId: number }> {
  const res = await api.post(`api/invitations/${invitationId}/accept/`, {});
  return res.data;
}

export async function declineInvitation(invitationId: number): Promise<void> {
  await api.post(`api/invitations/${invitationId}/decline/`, {});
}

export async function acceptInvitationByToken(
  token: string,
): Promise<{ projectId: number }> {
  const res = await api.post(`api/invitations/token/${token}/`, {});
  return res.data;
}

// Compatibility alias while call sites migrate to the shared error helper.
export function teamErrorCode(error: unknown): string | null {
  return getApiErrorCode(error);
}

export const ACCESS_ROLE_TRANSLATION_KEYS: Record<AccessRole, string> = {
  owner: 'project.team.accessRoles.owner',
  admin: 'project.team.accessRoles.admin',
  editor: 'project.team.accessRoles.editor',
  viewer: 'project.team.accessRoles.viewer',
};

export const TEAM_ROLE_TRANSLATION_KEYS: Record<string, string> = {
  producer: 'project.team.professionalRoles.producer',
  director: 'project.team.professionalRoles.director',
  screenwriter: 'project.team.professionalRoles.screenwriter',
  character_artist: 'project.team.professionalRoles.character_artist',
  environment_artist: 'project.team.professionalRoles.environment_artist',
  cinematographer: 'project.team.professionalRoles.cinematographer',
  editor: 'project.team.professionalRoles.editor',
  sound_designer: 'project.team.professionalRoles.sound_designer',
  other: 'project.team.professionalRoles.other',
};
