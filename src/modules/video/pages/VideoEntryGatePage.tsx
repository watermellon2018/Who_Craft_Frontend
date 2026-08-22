import React, {useEffect} from 'react';
import {useNavigate, useParams} from 'react-router-dom';

import {
  videoGenerationPath,
  videoPreparationPath,
} from '../../../routes/pathConstant';
import {useVideoPreparation} from '../useVideoPreparation';
import '../video.css';
import VideoPreparationState from './VideoPreparationState';

export default function VideoEntryGatePage() {
  const navigate = useNavigate();
  const {projectId = ''} = useParams<{projectId: string}>();
  const {data, error, loading, retry} = useVideoPreparation(projectId);

  useEffect(() => {
    if (!data) return;
    const destination = data.ready && data.project.permissions.canRunGeneration
      ? videoGenerationPath(projectId)
      : videoPreparationPath(projectId);
    navigate(destination, {replace: true});
  }, [data, navigate, projectId]);

  return (
    <div className="video-preparation-page">
      <VideoPreparationState error={loading ? null : error} onRetry={retry} />
    </div>
  );
}
