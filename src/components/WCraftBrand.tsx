import React from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';

import PathConstants from '../routes/pathConstant';
import './WCraftBrand.css';

interface WCraftBrandProps {
  ariaLabel?: string;
  className?: string;
  to?: string;
}

export default function WCraftBrand({
  ariaLabel,
  className = '',
  to = PathConstants.HOME,
}: WCraftBrandProps) {
  const {t} = useTranslation();
  const classes = ['wcraft-brand', className].filter(Boolean).join(' ');

  return <Link to={to} className={classes} aria-label={ariaLabel ?? t('common.openHome')}>
    <span className="wcraft-brand__mark" aria-hidden="true">W</span>
    <span className="wcraft-brand__text">WCraft</span>
  </Link>;
}
