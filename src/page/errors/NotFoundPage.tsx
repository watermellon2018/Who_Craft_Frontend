import React from 'react';
import {Link} from 'react-router-dom';
import PathConstants from '../../routes/pathConstant';

export default function NotFoundPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'var(--craft-bg-deep)',
        color: 'var(--craft-text)',
      }}
    >
      <section style={{maxWidth: 480, textAlign: 'center'}}>
        <div style={{fontSize: 64, fontWeight: 800, color: 'var(--craft-accent)'}}>404</div>
        <h1>Страница не найдена</h1>
        <p style={{color: 'var(--craft-text-muted)'}}>
          Проверьте адрес или вернитесь к списку проектов.
        </p>
        <Link to={PathConstants.PROJECTS}>К проектам</Link>
      </section>
    </main>
  );
}
