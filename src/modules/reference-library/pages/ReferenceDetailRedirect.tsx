import React from 'react';
import {Navigate, useParams} from 'react-router-dom';

import PathConstants, {referenceEditPath} from '../../../routes/pathConstant';

export default function ReferenceDetailRedirect() {
  const {projectId, referenceId} = useParams<{projectId: string; referenceId: string}>();

  if (!projectId || !referenceId) {
    return <Navigate to={PathConstants.PROJECTS} replace />;
  }

  return <Navigate to={referenceEditPath(projectId, referenceId)} replace />;
}
