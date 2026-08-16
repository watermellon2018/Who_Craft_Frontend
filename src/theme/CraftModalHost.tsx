import {Modal} from 'antd';
import type {ModalFuncProps} from 'antd';
import {useEffect} from 'react';

type ContextualModalApi = ReturnType<typeof Modal.useModal>[0];

let contextualModalApi: ContextualModalApi | null = null;

export const craftModal = {
  confirm: (config: ModalFuncProps) => (
    contextualModalApi?.confirm(config) ?? Modal.confirm(config)
  ),
  error: (config: ModalFuncProps) => (
    contextualModalApi?.error(config) ?? Modal.error(config)
  ),
  info: (config: ModalFuncProps) => (
    contextualModalApi?.info(config) ?? Modal.info(config)
  ),
  success: (config: ModalFuncProps) => (
    contextualModalApi?.success(config) ?? Modal.success(config)
  ),
  warning: (config: ModalFuncProps) => (
    contextualModalApi?.warning(config) ?? Modal.warning(config)
  ),
};

/**
 * Keeps imperative Ant Design modals inside the active ConfigProvider so they
 * receive the same Craft theme tokens as declarative components.
 */
export function CraftModalHost() {
  const [modalApi, contextHolder] = Modal.useModal();

  useEffect(() => {
    contextualModalApi = modalApi;
    return () => {
      if (contextualModalApi === modalApi) contextualModalApi = null;
    };
  }, [modalApi]);

  return contextHolder;
}
