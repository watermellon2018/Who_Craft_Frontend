import React from 'react';
import ProjectProgressCard from './ProjectProgressCard';
import QuickActionsCard from './QuickActionsCard';
import RecentActivityCard from './RecentActivityCard';
import {
  ActivityItemMock,
  ProgressLegendItem,
  QuickActionMock,
} from './mocks';

interface Props {
  progressOverall: number;
  progressLegend: ProgressLegendItem[];
  quickActions: QuickActionMock[];
  activity: ActivityItemMock[];
  onQuickAction?: (key: string) => void;
  loading?: boolean;
}

const RightProjectPanel: React.FC<Props> = ({
  progressOverall,
  progressLegend,
  quickActions,
  activity,
  onQuickAction,
  loading = false,
}) => {
  return (
    <aside className="flex flex-col gap-4">
      <ProjectProgressCard overall={progressOverall} legend={progressLegend} />
      <QuickActionsCard actions={quickActions} onAction={onQuickAction} />
      <RecentActivityCard activity={activity} loading={loading} />
    </aside>
  );
};

export default RightProjectPanel;
