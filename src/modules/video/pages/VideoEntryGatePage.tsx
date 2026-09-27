import React from 'react';
import {Navigate, useLocation, useParams} from 'react-router-dom';

import {videoGenerationPath} from '../../../routes/pathConstant';

export default function VideoEntryGatePage() {
  const {projectId = ''} = useParams<{projectId: string}>();
  const location = useLocation();
  // Readiness controls individual scenes; it must never hide saved videos.
  return <Navigate replace to={`${videoGenerationPath(projectId)}${location.search}`} />;
}
