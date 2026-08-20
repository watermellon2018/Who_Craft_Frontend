import React from 'react';
import {Form, Select, Tag} from 'antd';
import {useTranslation} from 'react-i18next';

import type {MusicModelSpec} from '../types';

interface MusicModelSelectorProps {
  disabled?: boolean;
  models: MusicModelSpec[];
  onChange: (modelKey: string) => void;
  value: string;
}

function formatUnitPrice(price: number): string {
  if (Number.isInteger(price * 100)) return price.toFixed(2);
  return price.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

function routeDetail(model: MusicModelSpec): {price: number | null; providers: string} {
  const routes = model.routes.filter((route) => route.configured);
  const availableRoutes = routes.length ? routes : model.routes;
  const providers = Array.from(new Set(
    availableRoutes.map((route) => route.providerDisplayName),
  ))
    .join(', ');
  const prices = availableRoutes
    .filter((route) => route.unitCostUsd != null && String(route.unitCostUsd).trim() !== '')
    .map((route) => Number(route.unitCostUsd))
    .filter((price) => Number.isFinite(price));
  return {
    price: prices.length ? Math.min(...prices) : null,
    providers,
  };
}

export default function MusicModelSelector({
  disabled = false,
  models,
  onChange,
  value,
}: MusicModelSelectorProps) {
  const {t} = useTranslation();
  const options = models.map((model) => {
    const {price, providers} = routeDetail(model);
    const detail = price == null
      ? providers
      : t('musicStudio.model.routeDetail', {price: formatUnitPrice(price), providers});
    return {
      disabled: !model.configured,
      label: (
        <span className="music-model-option">
          <span className="music-model-option__title">
            {model.label}
            {model.preview && <Tag>{t('musicStudio.model.preview')}</Tag>}
          </span>
          {detail && <small>{detail}</small>}
        </span>
      ),
      value: model.key,
    };
  });

  return (
    <section className="music-card music-model-card">
      <Form layout="vertical" component="div">
        <Form.Item
          label={t('musicStudio.model.label')}
          extra={t('musicStudio.model.helper')}
        >
          <Select
            aria-label={t('musicStudio.model.label')}
            disabled={disabled}
            options={options}
            value={value}
            onChange={onChange}
          />
        </Form.Item>
      </Form>
    </section>
  );
}
