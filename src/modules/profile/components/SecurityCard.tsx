import {LogoutOutlined, SafetyCertificateOutlined} from '@ant-design/icons';
import {Button, message, Modal} from 'antd';
import Cookies from 'js-cookie';
import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';

import {clearStoredUserToken} from '../../../api/http';
import PathConstants from '../../../routes/pathConstant';
import {logoutAllSessions} from '../api/profileApi';

interface Props {
  embedded?: boolean;
}

export default function SecurityCard({embedded = false}: Props) {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleLogoutAll = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await logoutAllSessions();
      clearStoredUserToken();
      Cookies.remove('token');
      message.success(t('profile.settings.security.success'));
      navigate(PathConstants.LOGIN, {replace: true});
    } catch {
      message.error(t('profile.settings.security.error'));
      setSubmitting(false);
    }
  };

  const content = (
    <>
      <div className="profile-settings-section-heading">
        <SafetyCertificateOutlined aria-hidden="true" />
        <h2 id="security-title" className="profile-settings-card__title font-semibold text-base">
          {t('profile.settings.security.title')}
        </h2>
      </div>

      <div className="profile-settings-security-row">
        <div>
          <h3>{t('profile.settings.security.logoutAll')}</h3>
          <p>{t('profile.settings.security.description')}</p>
        </div>
        <Button
          danger
          disabled={submitting}
          icon={<LogoutOutlined aria-hidden="true" />}
          onClick={() => setOpen(true)}
        >
          {t('profile.settings.security.logoutAll')}
        </Button>
      </div>

      <Modal
        centered
        closable={!submitting}
        confirmLoading={submitting}
        keyboard={!submitting}
        maskClosable={false}
        okButtonProps={{danger: true}}
        okText={t('profile.settings.security.confirmAction')}
        onCancel={() => {
          if (!submitting) setOpen(false);
        }}
        onOk={() => void handleLogoutAll()}
        open={open}
        title={t('profile.settings.security.modalTitle')}
        cancelText={t('common.cancel')}
      >
        <p className="profile-delete-modal__description">
          {t('profile.settings.security.modalDescription')}
        </p>
      </Modal>
    </>
  );

  if (embedded) {
    return (
      <section className="profile-settings-security-section" aria-labelledby="security-title">
        {content}
      </section>
    );
  }

  return (
    <section className="profile-settings-card rounded-2xl p-5 shadow-md" aria-labelledby="security-title">
      {content}
    </section>
  );
}
