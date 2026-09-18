import React from 'react';
import type {ReactNode} from 'react';
import {Translation} from 'react-i18next';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = {hasError: false};

  static getDerivedStateFromError(): State {
    return {hasError: true};
  }


  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <Translation>
        {(t) => (
          <main
            role="alert"
            style={{
              minHeight: '100vh',
              display: 'grid',
              placeItems: 'center',
              padding: 24,
              background: '#0d1016',
              color: '#fff',
            }}
          >
            <section style={{maxWidth: 520, textAlign: 'center'}}>
              <h1>{t('appErrors.boundary.title')}</h1>
              <p style={{color: 'rgba(255,255,255,0.65)'}}>
                {t('appErrors.boundary.description')}
              </p>
              <div style={{display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20}}>
                <button type="button" onClick={() => window.location.reload()}>
                  {t('appErrors.boundary.refresh')}
                </button>
                <a href="/project-list">{t('common.goToProjects')}</a>
              </div>
            </section>
          </main>
        )}
      </Translation>
    );
  }
}
