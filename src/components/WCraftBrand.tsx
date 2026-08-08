import React from 'react';
import {Link} from 'react-router-dom';

import PathConstants from '../routes/pathConstant';
import './WCraftBrand.css';

interface WCraftBrandProps {
  ariaLabel?: string;
  className?: string;
  to?: string;
}

export default function WCraftBrand({
  ariaLabel = 'Перейти на главную страницу',
  className = '',
  to = PathConstants.HOME,
}: WCraftBrandProps) {
  const classes = ['wcraft-brand', className].filter(Boolean).join(' ');

  return <Link to={to} className={classes} aria-label={ariaLabel}>
    <span className="wcraft-brand__mark" aria-hidden="true">W</span>
    <span className="wcraft-brand__text">WCraft</span>
  </Link>;
}
