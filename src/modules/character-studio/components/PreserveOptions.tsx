import React from 'react';

export default function PreserveOptions({values, identityLocked}: {values: Record<string, boolean>; identityLocked: boolean}) {
  const labels: Record<string, string> = {
    identity: 'Идентичность',
    face: 'Лицо',
    hair: 'Волосы',
    outfit: 'Одежда',
    style: 'Стиль',
  };

  return (
    <div className="preserve-options">
      {['identity', 'face', 'hair', 'outfit', 'style'].map((key) => (
        <span key={key} className={`preserve-options__item${values[key] ? ' is-active' : ''}${identityLocked && key === 'identity' ? ' is-locked' : ''}`}>
          {labels[key]}
        </span>
      ))}
    </div>
  );
}
