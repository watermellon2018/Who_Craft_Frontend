import React from 'react';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  InboxOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import {Tag} from 'antd';
import {useTranslation} from 'react-i18next';

import type {ReferenceStatus} from '../types';

const STATUS_META: Record<ReferenceStatus, {color: string; icon: React.ReactNode}> = {
  archived: {color: 'default', icon: <InboxOutlined />},
  draft: {color: 'default', icon: <ClockCircleOutlined />},
  failed: {color: 'error', icon: <CloseCircleOutlined />},
  generating: {color: 'processing', icon: <LoadingOutlined />},
  ready: {color: 'success', icon: <CheckCircleOutlined />},
};

export default function ReferenceStatusTag({status}: {status: ReferenceStatus}) {
  const {t} = useTranslation();
  const meta = STATUS_META[status];
  return (
    <Tag className="reference-status" color={meta.color} icon={meta.icon}>
      {t(`referenceLibrary.status.${status}`)}
    </Tag>
  );
}
