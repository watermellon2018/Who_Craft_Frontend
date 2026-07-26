import React from 'react';
import ProjectProgressCard from './ProjectProgressCard';
import QuickActionsCard from './QuickActionsCard';
import RecentActivityCard from './RecentActivityCard';
import ProjectTeamCard from '../team/ProjectTeamCard';
import {
  ActivityItemMock,
  ProgressLegendItem,
  ProjectMock,
  QuickActionMock,
} from './mocks';
import { AccessRole } from '../../../../api/projects/team';
import '../team/team.css';

interface Props {
  project: ProjectMock;
  progressOverall: number;
  progressLegend: ProgressLegendItem[];
  quickActions: QuickActionMock[];
  activity: ActivityItemMock[];
  onQuickAction?: (key: string) => void;
  onOpenTeam: () => void;
  onInvite: () => void;
  loading?: boolean;
}

const RightProjectPanel: React.FC<Props> = ({
  project,
  progressOverall,
  progressLegend,
  quickActions,
  activity,
  onQuickAction,
  onOpenTeam,
  onInvite,
  loading = false,
}) => {
  return (
    <aside className="flex flex-col gap-4">
      <ProjectProgressCard overall={progressOverall} legend={progressLegend} />
      <ProjectTeamCard
        members={project.teamMembers || []}
        memberCount={project.memberCount ?? 1}
        currentUserRole={(project.currentUserRole as AccessRole) || null}
        ownerName={project.ownerName ?? null}
        canManageTeam={!!project.permissions?.canManageTeam}
        onOpenTeam={onOpenTeam}
        onInvite={onInvite}
      />
      <QuickActionsCard actions={quickActions} onAction={onQuickAction} />
      <RecentActivityCard activity={activity} loading={loading} />
    </aside>
  );
};

export default RightProjectPanel;
