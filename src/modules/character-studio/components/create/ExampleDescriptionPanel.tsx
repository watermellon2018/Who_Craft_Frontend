import React from 'react';
import {Button} from 'antd';

export const exampleCharacterValues = {
  name: 'Мира',
  character_type: 'human',
  lifecycle_stage: '17',
  gender: 'female',
  role: 'Главная героиня',
  appearance_description: 'Стройная 17-летняя девушка со светлой кожей, зелеными миндалевидными глазами и растрепанными рыжими волосами до плеч. У нее усталое, но умное выражение лица. Носит темную школьную форму и черные ботинки.',
  body_structure: 'Человекоподобное',
  surface_material: 'Кожа',
  special_features: 'Рыжие волосы, зеленые глаза, усталое выражение лица',
  short_description: 'Рыжеволосая школьница с тревожным и саркастичным характером.',
  personality_description: 'Тревожная, саркастичная и наблюдательная. Она хочет казаться сильнее, чем чувствует себя на самом деле, и замечает детали, которые другие пропускают.',
  backstory: 'Выросла в маленьком городе и рано научилась полагаться на себя. Ей трудно доверять людям, но она очень преданна тем, кого подпускает близко.',
  visual_style: 'cinematic_realism',
};

interface ExampleDescriptionPanelProps {
  onUseExample: () => void;
}

export default function ExampleDescriptionPanel({onUseExample}: ExampleDescriptionPanelProps) {
  return (
    <section className="create-side-card">
      <div className="create-side-card__header">
        <h2>Пример описания</h2>
      </div>
      <p className="example-description">
        Стройная 17-летняя девушка со светлой кожей, зелеными миндалевидными глазами и растрепанными рыжими волосами до плеч. У нее усталое, но умное выражение лица. Носит темную школьную форму и черные ботинки. По характеру тревожная, саркастичная и наблюдательная.
      </p>
      <Button className="character-create-button character-create-button--outline" onClick={onUseExample}>
        Использовать пример
      </Button>
    </section>
  );
}
