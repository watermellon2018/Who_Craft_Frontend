import React from "react";
import {notification} from "antd";
import i18n from '../../i18n';

/**
 * Opens a notification with the requested message and severity.
 * When no title is provided, the current interface language supplies the default title.
 */

const openNotificationWithIcon = (desc: React.ReactNode,
                                  mes?: React.ReactNode,
                                  type: 'success' | 'info' | 'error' | 'warning' ='error') => {
    notification[type]({
        message: mes ?? i18n.t('notifications.invalidInput'),
        description: desc,
    });
};

export {
    openNotificationWithIcon
};
