import React from 'react';
import type {ReactNode} from 'react';

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
          <h1>Не удалось открыть страницу</h1>
          <p style={{color: 'rgba(255,255,255,0.65)'}}>
            Произошла непредвиденная ошибка интерфейса. Обновите страницу или вернитесь к проектам.
          </p>
          <div style={{display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20}}>
            <button type="button" onClick={() => window.location.reload()}>
              Обновить
            </button>
            <a href="/project-list">К проектам</a>
          </div>
        </section>
      </main>
    );
  }
}