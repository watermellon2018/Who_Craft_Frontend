import {UserOutlined} from '@ant-design/icons';
import {Avatar} from 'antd';
import React from 'react';

import type {MessagingUser} from '../../api/generated/contracts';
import {backendAssetUrl} from '../../api/http';

export function UserAvatar({user}: {user: MessagingUser}) {
  return <Avatar className="messaging-avatar" size={42}
    src={user.is_active && user.avatar_url ? backendAssetUrl(user.avatar_url) : undefined}
    icon={<UserOutlined aria-hidden />} alt="" />;
}
