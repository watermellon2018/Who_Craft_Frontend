import React, { useEffect, useRef, useState } from 'react';
import { CaretDownOutlined, CheckOutlined, LoadingOutlined } from '@ant-design/icons';
import { ProjectStatusKey } from './mocks';
import {CRAFT_ACCENT} from '../../../../constants/theme';

const STATUS_OPTIONS: Array<{ key: ProjectStatusKey; label: string }> = [
  { key: 'draft', label: 'Черновик' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'completed', label: 'Завершён' },
  { key: 'archived', label: 'В архиве' },
];

const STATUS_ACCENT: Record<ProjectStatusKey, { bg: string; border: string; color: string; dot: string }> = {
  draft: {
    bg: 'rgba(148, 163, 184, 0.12)',
    border: 'rgba(148, 163, 184, 0.32)',
    color: '#94a3b8',
    dot: '#94a3b8',
  },
  in_progress: {
    bg: 'rgba(250, 176, 5, 0.12)',
    border: 'rgba(250, 176, 5, 0.30)',
    color: 'var(--craft-accent)',
    dot: CRAFT_ACCENT,
  },
  completed: {
    bg: 'rgba(34, 197, 94, 0.14)',
    border: 'rgba(34, 197, 94, 0.34)',
    color: '#4ade80',
    dot: '#22c55e',
  },
  archived: {
    bg: 'rgba(120, 113, 108, 0.18)',
    border: 'rgba(120, 113, 108, 0.36)',
    color: '#a8a29e',
    dot: '#a8a29e',
  },
};

interface Props {
  status: ProjectStatusKey;
  statusLabel: string;
  disabled?: boolean;
  loading?: boolean;
  onChange: (next: ProjectStatusKey) => void;
}

const StatusDropdown: React.FC<Props> = ({ status, statusLabel, disabled, loading, onChange }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const accent = STATUS_ACCENT[status] || STATUS_ACCENT.in_progress;

  const handleSelect = (next: ProjectStatusKey) => {
    setOpen(false);
    if (next === status) return;
    onChange(next);
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <button
        type="button"
        onClick={() => !disabled && !loading && setOpen((o) => !o)}
        disabled={disabled || loading}
        className="proj-status-pill"
        style={{
          background: accent.bg,
          borderColor: accent.border,
          color: accent.color,
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {loading ? (
          <LoadingOutlined style={{ fontSize: 11 }} />
        ) : (
          <span className="dot" style={{ background: accent.dot, boxShadow: `0 0 8px ${accent.dot}b3` }} />
        )}
        {statusLabel || status}
        {!disabled && <CaretDownOutlined style={{ fontSize: 10 }} />}
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 1000,
            minWidth: 180,
            background: '#171B24',
            border: '1px solid rgba(255, 255, 255, 0.10)',
            borderRadius: 12,
            padding: 4,
            boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
            overflow: 'hidden',
          }}
        >
          {STATUS_OPTIONS.map((opt) => {
            const isActive = opt.key === status;
            const optAccent = STATUS_ACCENT[opt.key];
            return (
              <button
                key={opt.key}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelect(opt.key)}
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: isActive ? 'rgba(250,176,5,0.10)' : 'transparent',
                  color: isActive ? 'var(--craft-accent)' : 'rgba(255,255,255,0.85)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: optAccent.dot,
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1 }}>{opt.label}</span>
                {isActive && <CheckOutlined style={{ fontSize: 11, color: 'var(--craft-accent)' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StatusDropdown;
