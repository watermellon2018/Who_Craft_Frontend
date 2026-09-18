import React from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import PathConstants from '../../routes/pathConstant';

export default function NotFoundPage() {
  const {t} = useTranslation();

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
        <h1>{t('appErrors.notFound.title')}</h1>
        <p style={{color: 'var(--craft-text-muted)'}}>
          {t('appErrors.notFound.description')}
        </p>
        <Link to={PathConstants.PROJECTS}>{t('common.goToProjects')}</Link>
      </section>
    </main>
  );
}
