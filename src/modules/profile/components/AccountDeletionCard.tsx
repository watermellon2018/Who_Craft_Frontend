import {Button, Input, Modal} from 'antd';
import type {InputRef} from 'antd';
import Cookies from 'js-cookie';
import React, {useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';

import {getApiErrorCode} from '../../../api/errors';
import {clearStoredUserToken} from '../../../api/http';
import PathConstants from '../../../routes/pathConstant';
import {deleteAccount} from '../api/profileApi';

const DELETE_ERROR_KEYS: Record<string, string> = {
  ACCOUNT_DELETE_PASSWORD_INVALID: 'profile.settings.delete.errors.passwordInvalid',
  ACCOUNT_DELETE_PASSWORD_REQUIRED: 'profile.settings.delete.errors.passwordRequired',
  ACCOUNT_HAS_OWNED_PROJECTS: 'profile.settings.delete.errors.ownedProjects',
};

export default function AccountDeletionCard() {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const passwordRef = useRef<InputRef>(null);
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => passwordRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  const closeModal = () => {
    if (deleting) return;
    setOpen(false);
    setCurrentPassword('');
    setError('');
  };

  const handleDelete = async () => {
    if (!currentPassword.trim()) return;

    setDeleting(true);
    setError('');
    try {
      await deleteAccount(currentPassword);
      clearStoredUserToken();
      Cookies.remove('token');
      navigate(PathConstants.LOGIN, {replace: true});
    } catch (requestError) {
      const code = getApiErrorCode(requestError);
      setError(t((code && DELETE_ERROR_KEYS[code]) || 'profile.settings.delete.errors.generic'));
      window.setTimeout(() => passwordRef.current?.focus(), 0);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="profile-danger-card rounded-2xl p-5 shadow-md" aria-labelledby="delete-account-title">
      <h2 id="delete-account-title" className="profile-danger-card__title font-semibold text-base">
        {t('profile.settings.delete.title')}
      </h2>
      <p className="profile-danger-card__description mt-2 text-sm">
        {t('profile.settings.delete.description')}
      </p>
      <p className="profile-danger-card__description mt-2 text-sm">
        {t('profile.settings.delete.ownedProjectsHint')}
      </p>
      <Button danger className="mt-4" onClick={() => setOpen(true)}>
        {t('profile.settings.delete.openAction')}
      </Button>

      <Modal
        centered
        closable={!deleting}
        confirmLoading={deleting}
        keyboard={!deleting}
        maskClosable={false}
        okButtonProps={{danger: true, disabled: !currentPassword.trim()}}
        okText={t('profile.settings.delete.confirmAction')}
        onCancel={closeModal}
        onOk={() => void handleDelete()}
        open={open}
        title={t('profile.settings.delete.modalTitle')}
        cancelText={t('common.cancel')}
      >
        <p className="profile-delete-modal__description">
          {t('profile.settings.delete.modalDescription')}
        </p>
        <div className="profile-delete-modal__field">
          <label htmlFor="delete-account-current-password">
            {t('profile.settings.delete.passwordLabel')}
          </label>
          <Input.Password
            ref={passwordRef}
            id="delete-account-current-password"
            name="current-password"
            autoComplete="current-password"
            aria-describedby={error ? 'delete-account-error' : undefined}
            aria-invalid={Boolean(error)}
            disabled={deleting}
            onChange={(event) => {
              setCurrentPassword(event.target.value);
              setError('');
            }}
            onPressEnter={() => {
              if (currentPassword.trim() && !deleting) void handleDelete();
            }}
            status={error ? 'error' : undefined}
            value={currentPassword}
          />
          {error && (
            <p id="delete-account-error" className="profile-delete-modal__error" role="alert">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </section>
  );
}
