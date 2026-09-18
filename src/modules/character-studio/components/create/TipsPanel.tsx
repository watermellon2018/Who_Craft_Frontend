import React from 'react';
import {CheckCircleOutlined} from '@ant-design/icons';
import {useTranslation} from 'react-i18next';

const tipKeys = ['shape', 'outfit', 'details', 'mood', 'entity'] as const;

export default function TipsPanel() {
  const {t} = useTranslation();
  return (
    <section className="create-side-card">
      <div className="create-side-card__header">
        <h2>{t('characterStudio.create.tips.title')}</h2>
      </div>
      <ul className="tips-list">
        {tipKeys.map((key) => (
          <li key={key}>
            <CheckCircleOutlined />
            <span>{t(`characterStudio.create.tips.${key}`)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
