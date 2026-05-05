import {useEffect} from 'react';
import {useLocation, useParams, useSearchParams} from 'react-router-dom';

function getCachedProjectId() {
  const cached = localStorage.getItem('projectInfoCache');
  if (!cached) return '';

  try {
    return String(JSON.parse(cached)?.id || '');
  } catch {
    return '';
  }
}

export function useProjectIdFromRoute() {
  const params = useParams();
  const location = useLocation();
  const [search] = useSearchParams();
  const state = location.state as {project_id?: string | number; projectId?: string | number} | null;
  const projectId = String(
    params.projectId
    || search.get('project_id')
    || search.get('projectId')
    || search.get('id')
    || state?.project_id
    || state?.projectId
    || localStorage.getItem('projectId')
    || getCachedProjectId()
    || ''
  );

  useEffect(() => {
    if (projectId) {
      localStorage.setItem('projectId', projectId);
    }
  }, [projectId]);

  return projectId;
}
