import type {TabsProps} from 'antd';
import {Tabs} from 'antd';
import React from 'react';

interface VisualInspectorShellProps {
  activeTab: string;
  bottomContent?: React.ReactNode;
  items: TabsProps['items'];
  onTabChange: (tab: string) => void;
}

export default function VisualInspectorShell({
  activeTab,
  bottomContent,
  items,
  onTabChange,
}: VisualInspectorShellProps) {
  return (
    <aside className="visual-reference-inspector">
      <div className="visual-reference-inspector__properties">
        <Tabs
          activeKey={activeTab}
          items={items}
          onChange={onTabChange}
        />
      </div>
      {bottomContent}
    </aside>
  );
}
