import React, { useEffect, useState } from 'react';
import { Modal, Input, Switch, message } from 'antd';
import { ProjectMock } from './mocks';

interface EditProjectFormValues {
  title: string;
  description: string;
  tags: string[];
  is_favorite: boolean;
}

interface Props {
  open: boolean;
  project: ProjectMock;
  onCancel: () => void;
  onSubmit: (values: EditProjectFormValues) => Promise<void>;
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: '#fff',
  borderRadius: 10,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'rgba(255,255,255,0.85)',
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 6,
};

const fieldHintStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.45)',
  fontSize: 11,
  marginTop: 4,
};

const errorStyle: React.CSSProperties = {
  color: '#f87171',
  fontSize: 12,
  marginTop: 4,
};

const EditProjectModal: React.FC<Props> = ({ open, project, onCancel, onSubmit }) => {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const [tagsRaw, setTagsRaw] = useState((project.genres || []).join(', '));
  const [isFavorite, setIsFavorite] = useState(!!project.isFavorite);
  const [submitting, setSubmitting] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  // Reset form when project changes or modal reopens.
  useEffect(() => {
    if (open) {
      setTitle(project.title);
      setDescription(project.description);
      setTagsRaw((project.genres || []).join(', '));
      setIsFavorite(!!project.isFavorite);
      setTitleError(null);
      setSubmitting(false);
    }
  }, [open, project]);

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError('Название обязательно');
      return;
    }
    if (trimmedTitle.length > 255) {
      setTitleError('Название не может быть длиннее 255 символов');
      return;
    }

    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t) => t.slice(0, 50));

    setSubmitting(true);
    try {
      await onSubmit({
        title: trimmedTitle,
        description,
        tags,
        is_favorite: isFavorite,
      });
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 400) {
        message.error('Проверьте поля формы');
      } else if (status === 403) {
        message.error('Нет прав для редактирования');
      } else {
        message.error('Не удалось сохранить изменения');
      }
      setSubmitting(false);
    }
    // On success the parent closes the modal; submitting flag will reset on next open.
  };

  return (
    <Modal
      open={open}
      title={<span style={{ color: '#fff' }}>Редактировать проект</span>}
      okText="Сохранить"
      cancelText="Отмена"
      onCancel={() => (submitting ? null : onCancel())}
      onOk={handleSubmit}
      confirmLoading={submitting}
      maskClosable={!submitting}
      width={600}
      okButtonProps={{
        style: {
          background: 'var(--craft-accent)',
          borderColor: 'var(--craft-accent)',
          color: '#111827',
          fontWeight: 700,
        },
      }}
      cancelButtonProps={{
        style: {
          background: 'rgba(255,255,255,0.04)',
          borderColor: 'rgba(255,255,255,0.10)',
          color: 'rgba(255,255,255,0.88)',
        },
      }}
      styles={{
        content: { background: '#151922', borderRadius: 16 },
        header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.06)' },
        body: { background: 'transparent', padding: '20px 0 4px' },
        mask: { background: 'rgba(0,0,0,0.55)' },
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label style={labelStyle}>Название проекта</label>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (titleError) setTitleError(null);
            }}
            maxLength={255}
            placeholder="Например, Cyber City Dawn"
            style={inputStyle}
            disabled={submitting}
          />
          {titleError && <div style={errorStyle}>{titleError}</div>}
        </div>

        <div>
          <label style={labelStyle}>Описание проекта</label>
          <Input.TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Короткий синопсис — о чём проект"
            autoSize={{ minRows: 3, maxRows: 8 }}
            style={inputStyle}
            disabled={submitting}
          />
        </div>

        <div>
          <label style={labelStyle}>Теги</label>
          <Input
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="Научная фантастика, Киберпанк, Драма"
            style={inputStyle}
            disabled={submitting}
          />
          <div style={fieldHintStyle}>Разделяйте теги запятой</div>
        </div>

        <div>
          <label style={labelStyle}>Обложка проекта</label>
          <div
            style={{
              ...inputStyle,
              padding: '12px 14px',
              color: 'rgba(255,255,255,0.45)',
              fontSize: 12,
            }}
          >
            Загрузка обложки появится позже.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Switch
            checked={isFavorite}
            onChange={setIsFavorite}
            disabled={submitting}
            style={{ background: isFavorite ? 'var(--craft-accent)' : 'rgba(255,255,255,0.16)' }}
          />
          <label style={{ ...labelStyle, marginBottom: 0 }}>В избранном</label>
        </div>
      </div>
    </Modal>
  );
};

export default EditProjectModal;
