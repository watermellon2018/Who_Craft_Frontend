import React from 'react';
import {Button, Modal, Tag} from 'antd';
import {LockOutlined} from '@ant-design/icons';

export default function IdentityLockButton({locked, onLock}: {locked: boolean; onLock: () => void}) {
  if (locked) return <Tag icon={<LockOutlined />} color="gold">Идентичность закреплена</Tag>;
  return (
    <Button
      icon={<LockOutlined />}
      onClick={() => Modal.confirm({title: 'Закрепить идентичность?', content: 'Лицо, возраст, пропорции, цвет глаз и ключевые черты будут сохранены для будущих правок.', okText: 'Закрепить', cancelText: 'Отмена', onOk: onLock})}
    >
      Зафиксировать личность
    </Button>
  );
}
