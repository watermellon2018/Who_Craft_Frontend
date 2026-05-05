import React from 'react';
import {Button} from 'antd';
import {ArrowLeftOutlined} from '@ant-design/icons';
import {useNavigate, useParams} from 'react-router-dom';
import {useProjectIdFromRoute} from '../hooks/useProjectIdFromRoute';

// Route stub for the upcoming 3D modeling step. Wired so the proceed-to-3D
// button has a valid destination instead of crashing the router; replace the
// body when the actual 3D pipeline lands.
const Character3DPlaceholderPage: React.FC = () => {
  const navigate = useNavigate();
  const params = useParams();
  const projectId = useProjectIdFromRoute();
  const characterId = String(params.characterId || '');

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        textAlign: 'center',
        color: '#f7efe0',
        gap: 16,
      }}
    >
      <h1 style={{fontSize: 28, margin: 0}}>3D модель</h1>
      <p style={{maxWidth: 480, color: '#929aa8', margin: 0, lineHeight: 1.6}}>
        Шаг подготовки 3D модели находится в разработке. Референсы зафиксированы
        и будут использованы автоматически, как только этап появится.
      </p>
      <Button
        type="primary"
        icon={<ArrowLeftOutlined />}
        onClick={() => {
          if (characterId) {
            navigate(`/project/${projectId}/characters/${characterId}/references`);
          } else {
            navigate(-1);
          }
        }}
      >
        Вернуться к референсам
      </Button>
    </div>
  );
};

export default Character3DPlaceholderPage;
