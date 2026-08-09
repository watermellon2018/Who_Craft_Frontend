import {EnvironmentOutlined, LockOutlined} from '@ant-design/icons';
import React from 'react';

export default function LocationsPlaceholder({onOpen}: {onOpen: () => void}) {
  return <main className="locations-placeholder">
    <div className="locations-placeholder__orb locations-placeholder__orb--one" />
    <div className="locations-placeholder__orb locations-placeholder__orb--two" />
    <section>
      <span className="locations-placeholder__icon"><EnvironmentOutlined /></span>
      <span className="script-eyebrow"><LockOutlined /> МАТЕРИАЛЫ ПРОЕКТА</span>
      <h1>Визуальная библиотека</h1>
      <p>
        Собирайте окружение, предметы и другие повторяющиеся детали, чтобы сохранять
        единый визуальный стиль во всех сценах.
      </p>
      <button
        type="button"
        className="script-button script-button--primary"
        onClick={onOpen}
      >
        Открыть визуальную библиотеку
      </button>
      <div className="locations-preview" aria-hidden="true">
        <span /><span /><span />
      </div>
    </section>
  </main>;
}
