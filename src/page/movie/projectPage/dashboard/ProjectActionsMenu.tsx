import React, { useEffect, useRef, useState } from 'react';
import {
  EditOutlined,
  InboxOutlined,
  DeleteOutlined,
  MoreOutlined,
  UndoOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { ProjectPermissionFlags, ProjectStatusKey } from './mocks';

interface Props {
  status: ProjectStatusKey;
  permissions?: ProjectPermissionFlags;
  onEdit: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onLeave?: () => void;
}

const ProjectActionsMenu: React.FC<Props> = ({
  status,
  permissions,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
  onLeave,
}) => {
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

  // Permissions come from the backend (single source of truth). Fall back to
  // a read-only assumption when they aren't loaded yet.
  const canEditSettings = !!permissions?.canEditSettings;
  const canArchive = canEditSettings;
  const canDelete = !!permissions?.canDeleteProject;
  const canLeave = !!permissions?.canLeaveProject && !!onLeave;
  const isArchived = status === 'archived';

  // Hide menu entirely if there is nothing the user can do.
  if (!canEditSettings && !canArchive && !canDelete && !canLeave) return null;

  const handle = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        className="proj-btn proj-btn-secondary proj-btn-icon"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Действия с проектом"
      >
        <MoreOutlined />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 1000,
            minWidth: 220,
            background: '#171B24',
            border: '1px solid rgba(255, 255, 255, 0.10)',
            borderRadius: 12,
            padding: 4,
            boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
            overflow: 'hidden',
          }}
        >
          {canEditSettings && (
            <MenuItem icon={<EditOutlined />} label="Редактировать проект" onClick={handle(onEdit)} />
          )}
          {canArchive && !isArchived && (
            <MenuItem
              icon={<InboxOutlined />}
              label="Архивировать проект"
              onClick={handle(onArchive)}
            />
          )}
          {canArchive && isArchived && (
            <MenuItem
              icon={<UndoOutlined />}
              label="Восстановить проект"
              onClick={handle(onUnarchive)}
            />
          )}
          {canLeave && (
            <MenuItem
              icon={<LogoutOutlined />}
              label="Покинуть проект"
              onClick={handle(onLeave!)}
            />
          )}
          {canDelete && (
            <MenuItem
              icon={<DeleteOutlined />}
              label="Удалить проект"
              onClick={handle(onDelete)}
              danger
            />
          )}
        </div>
      )}
    </div>
  );
};

const MenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}> = ({ icon, label, danger, onClick }) => {
  const [hover, setHover] = useState(false);
  const baseColor = danger ? '#f87171' : 'rgba(255,255,255,0.88)';
  const hoverBg = danger ? 'rgba(239,68,68,0.16)' : 'rgba(255,255,255,0.05)';

  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        gap: 10,
        padding: '9px 12px',
        borderRadius: 8,
        background: hover ? hoverBg : 'transparent',
        color: baseColor,
        border: 'none',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 500,
        textAlign: 'left',
        transition: 'background 120ms ease',
      }}
    >
      <span style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  );
};

export default ProjectActionsMenu;
