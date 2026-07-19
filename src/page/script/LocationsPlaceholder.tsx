import {EnvironmentOutlined, LockOutlined} from '@ant-design/icons';
import React from 'react';

export default function LocationsPlaceholder() {
  return <main className="locations-placeholder">
    <div className="locations-placeholder__orb locations-placeholder__orb--one" />
    <div className="locations-placeholder__orb locations-placeholder__orb--two" />
    <section>
      <span className="locations-placeholder__icon"><EnvironmentOutlined /></span>
      <span className="script-eyebrow"><LockOutlined /> РАЗДЕЛ В РАЗРАБОТКЕ</span>
      <h1>Локации скоро появятся</h1>
      <p>
        Здесь можно будет собирать пространства истории, референсы, атмосферу и связывать
        локации со сценами. Пока продолжайте работу в сценарии и карточках.
      </p>
      <div className="locations-preview" aria-hidden="true">
        <span /><span /><span />
      </div>
    </section>
  </main>;
}
