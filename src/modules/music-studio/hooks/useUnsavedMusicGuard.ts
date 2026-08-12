import {useEffect} from 'react';
import {Modal} from 'antd';
import {useBlocker} from 'react-router-dom';

import i18n from '../../../i18n';

interface UnsavedMusicGuardCopy {
  description: string;
  leave: string;
  stay: string;
  title: string;
}

export function useUnsavedMusicGuard(isDirty: boolean, copy?: UnsavedMusicGuardCopy) {
  const blocker = useBlocker(isDirty);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const confirmation = Modal.confirm({
      cancelText: copy?.stay ?? i18n.t('musicStudio.unsaved.stay') as string,
      content: copy?.description ?? i18n.t('musicStudio.unsaved.description') as string,
      okText: copy?.leave ?? i18n.t('musicStudio.unsaved.leave') as string,
      onCancel: () => blocker.reset(),
      onOk: () => blocker.proceed(),
      title: copy?.title ?? i18n.t('musicStudio.unsaved.title') as string,
    });
    return () => confirmation.destroy();
  }, [blocker, copy?.description, copy?.leave, copy?.stay, copy?.title]);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);
}
