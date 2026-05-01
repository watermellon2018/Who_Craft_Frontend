import React from 'react';

interface FormSectionProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export default function FormSection({icon, title, subtitle, children}: FormSectionProps) {
  return (
    <section className="character-create-section">
      <div className="character-create-section__header">
        <span className="character-create-section__icon">{icon}</span>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="character-create-section__content">
        {children}
      </div>
    </section>
  );
}
