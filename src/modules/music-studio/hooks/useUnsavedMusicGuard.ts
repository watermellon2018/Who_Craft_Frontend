import {useEffect} from 'react';
import {Modal} from 'antd';
import {useBlocker} from 'react-router-dom';

import i18n from '../../../i18n';

export function useUnsavedMusicGuard(isDirty: boolean) {
  const blocker = useBlocker(isDirty);

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const confirmation = Modal.confirm({
      cancelText: i18n.t('musicStudio.unsaved.stay') as string,
      content: i18n.t('musicStudio.unsaved.description') as string,
      okText: i18n.t('musicStudio.unsaved.leave') as string,
      onCancel: () => blocker.reset(),
      onOk: () => blocker.proceed(),
      title: i18n.t('musicStudio.unsaved.title') as string,
    });
    return () => confirmation.destroy();
  }, [blocker]);

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
