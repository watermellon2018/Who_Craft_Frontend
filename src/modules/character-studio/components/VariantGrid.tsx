import React from 'react';
import {Button, Card, Image} from 'antd';
import {CharacterVariant} from '../types/character.types';

export default function VariantGrid({variants, selectedVariantId, onSelect, onApply}: {variants: CharacterVariant[]; selectedVariantId?: string; onSelect: (variant: CharacterVariant) => void; onApply: (variant: CharacterVariant) => void}) {
  return (
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12}}>
      {variants.map((variant, index) => (
        <Card key={variant.variant_id} size="small" title={`Вариант ${String.fromCharCode(65 + index)}`} style={{outline: selectedVariantId === variant.variant_id ? '2px solid #fab005' : 'none'}}>
          <Image src={variant.image_url} alt={`Вариант ${index + 1}`} preview={false} onClick={() => onSelect(variant)} style={{height: 150, objectFit: 'cover', cursor: 'pointer'}} />
          <div style={{display: 'flex', gap: 8, marginTop: 8}}>
            <Button size="small" onClick={() => onSelect(variant)}>Сравнить</Button>
            <Button size="small" type="primary" onClick={() => onApply(variant)}>Применить</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
