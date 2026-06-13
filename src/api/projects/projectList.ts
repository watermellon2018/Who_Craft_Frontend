import api from '../http';
import { AccessRole, TeamMember } from './team';

// Membership-aware project summary returned by GET /api/projects/.
// Includes the team-collaboration fields the "My Projects" cards render.
export interface ProjectListItem {
  id: number;
  title: string;
  description: string;
  status: 'draft' | 'in_progress' | 'completed' | 'archived';
  statusLabel: string;
  coverImageUrl: string | null;
  updatedAt: string | null;
  updatedAtLabel: string;
  isFavorite: boolean;
  tags: string[];
  stats: { charactersTotal: number; scenesTotal: number };
  // Team fields (present when the backend knows the current user).
  currentUserRole?: AccessRole;
  currentUserRoleLabel?: string;
  memberCount?: number;
  teamMembers?: Pick<
    TeamMember,
    'userId' | 'displayName' | 'initials' | 'avatarUrl'
  >[] & { role?: string }[];
  isTeamProject?: boolean;
  ownerUserId?: number | null;
}

export async function fetchProjectList(): Promise<ProjectListItem[]> {
  const res = await api.get<{ projects: ProjectListItem[] }>('api/projects/');
  return res.data.projects;
}

export async function deleteProjectById(
  projectId: number | string,
): Promise<void> {
  localStorage.removeItem('treeLeaf_' + projectId);
  await api.delete(`api/projects/${projectId}/`);
}
