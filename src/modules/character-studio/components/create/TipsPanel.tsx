import React from 'react';
import {CheckCircleOutlined} from '@ant-design/icons';

const tips = [
  'Уточняйте форму, материал и ключевые черты',
  'Опишите одежду, покров, цвета или фактуру',
  'Укажите уникальные детали или аксессуары',
  'Задайте общее настроение и впечатление',
  'Добавьте тип сущности и стадию жизни',
];

export default function TipsPanel() {
  return (
    <section className="create-side-card">
      <div className="create-side-card__header">
        <h2>Советы для лучшего результата</h2>
      </div>
      <ul className="tips-list">
        {tips.map((tip) => (
          <li key={tip}>
            <CheckCircleOutlined />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
