import React from 'react';
import type {AccessRole} from '../../../../api/projects/team';

import ProjectTeamCard from '../team/ProjectTeamCard';
import ProjectProgressCard from './ProjectProgressCard';
import QuickActionsCard from './QuickActionsCard';
import RecentActivityCard from './RecentActivityCard';
import type {
  ActivityItemMock,
  ProgressLegendItem,
  ProjectMock,
  QuickActionMock,
  StoryboardReviewSceneMock,
} from './mocks';
import type {DashboardVideoPreparationSummary} from './api';

import '../team/team.css';

interface Props {
  project: ProjectMock;
  progressOverall: number;
  progressLegend: ProgressLegendItem[];
  storyboardNeedsReview: number;
  storyboardReviewScenes: StoryboardReviewSceneMock[];
  quickActions: QuickActionMock[];
  activity: ActivityItemMock[];
  onQuickAction?: (key: string) => void;
  isQuickActionEnabled?: (key: string) => boolean;
  onOpenTeam: () => void;
  onInvite: () => void;
  loading?: boolean;
  videoPreparation?: DashboardVideoPreparationSummary | null;
  videoPreparationLabel?: string;
  onOpenVideoPreparation?: () => void;
}

const RightProjectPanel: React.FC<Props> = ({
  project,
  progressOverall,
  progressLegend,
  storyboardNeedsReview,
  storyboardReviewScenes,
  quickActions,
  activity,
  onQuickAction,
  isQuickActionEnabled,
  onOpenTeam,
  onInvite,
  loading = false,
  videoPreparation,
  videoPreparationLabel,
  onOpenVideoPreparation,
}) => {
  return (
    <aside className="flex flex-col gap-4">
      <ProjectProgressCard
        overall={progressOverall}
        legend={progressLegend}
        storyboardNeedsReview={storyboardNeedsReview}
        storyboardReviewScenes={storyboardReviewScenes}
      />
      <ProjectTeamCard
        members={project.teamMembers || []}
        memberCount={project.memberCount ?? 1}
        currentUserRole={(project.currentUserRole as AccessRole) || null}
        ownerName={project.ownerName ?? null}
        canManageTeam={!!project.permissions?.canManageTeam}
        onOpenTeam={onOpenTeam}
        onInvite={onInvite}
      />
      <QuickActionsCard
        actions={quickActions}
        onAction={onQuickAction}
        isActionEnabled={isQuickActionEnabled}
        videoPreparation={videoPreparation}
        videoPreparationLabel={videoPreparationLabel}
        onOpenVideoPreparation={onOpenVideoPreparation}
      />
      <RecentActivityCard activity={activity} loading={loading} />
    </aside>
  );
};

export default RightProjectPanel;
