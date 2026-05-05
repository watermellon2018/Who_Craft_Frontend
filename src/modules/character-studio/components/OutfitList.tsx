import React from 'react';
import {Button, List, Tag} from 'antd';
import {CharacterOutfit} from '../types/character.types';

export default function OutfitList({outfits, onSetDefault}: {outfits: CharacterOutfit[]; onSetDefault: (outfit: CharacterOutfit) => void}) {
  return <List dataSource={outfits} renderItem={(outfit) => <List.Item actions={[!outfit.is_default && <Button size="small" onClick={() => onSetDefault(outfit)}>Сделать основным</Button>]}>
    <List.Item.Meta title={<>{outfit.name} {outfit.is_default && <Tag color="gold">Основной</Tag>}</>} description={outfit.description} />
  </List.Item>} />;
}
