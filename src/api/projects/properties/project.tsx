import axios, { AxiosResponse } from 'axios';

// Strip a trailing slash so we can safely concatenate with paths that start
// with '/' — REACT_APP_BACKEND_URL in some envs ends with '/', producing '//'.
const backendUrl = (process.env.REACT_APP_BACKEND_URL || '').replace(/\/+$/, '');

// Legacy payload shape used by the old endpoints (kept for back-compat with
// callers that still rely on it). The new editor uses ProjectEditPayload below.
interface ProjectI {
    genre: string[];
    format: string;
    title: string;
    desc: string;
    annot: string;
    audience: string[];
    image: string;
}

// Payload for create/update through the new dashboard API.
interface ProjectEditPayload {
    title?: string;
    format?: string;
    genre?: string[];
    audience?: string[];
    annotation?: string;
    synopsis?: string;
    status?: string;
    is_favorite?: boolean;
    poster_image_data?: string; // data:image/...;base64,...
    poster_url?: string | null; // pass "" to clear
}

function authHeaders() {
    const token = localStorage.getItem('userId') || '';
    return { 'X-User-Token': token };
}

// ---- New API (preferred) ----

async function fetch_project(projectId: string | number): Promise<AxiosResponse<any>> {
    return axios.get(`${backendUrl}/api/projects/${projectId}/`, {
        headers: authHeaders(),
    });
}

async function patch_project(
    projectId: string | number,
    payload: ProjectEditPayload,
): Promise<AxiosResponse<any>> {
    return axios.patch(`${backendUrl}/api/projects/${projectId}/`, payload, {
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    });
}

async function create_project(payload: ProjectEditPayload): Promise<AxiosResponse<any>> {
    return axios.post(`${backendUrl}/api/projects/`, payload, {
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    });
}

async function fetch_projects_list(): Promise<AxiosResponse<any>> {
    return axios.get(`${backendUrl}/api/projects/`, {
        headers: authHeaders(),
    });
}

async function delete_project(projectId: string | number): Promise<AxiosResponse<any>> {
    localStorage.removeItem('treeLeaf_' + projectId);
    return axios.delete(`${backendUrl}/api/projects/${projectId}/`, {
        headers: authHeaders(),
    });
}

// ---- Legacy wrappers (kept so existing pages don't break) ----

async function create_new_project(data: ProjectI): Promise<any> {
    try {
        const token = localStorage.getItem('userId');
        return await axios.post(`${backendUrl}/api/projects/create/`, {
            data: { ...data, token_user: token },
            headers: {
                'Content-Type': 'multipart/form-data',
                Accept: 'application/json',
            },
        });
    } catch (error) {
        console.error('Error creating project (legacy):', error);
    }
}

async function get_all_list_projects(): Promise<any> {
    try {
        const token = localStorage.getItem('userId');
        return await axios.get(`${backendUrl}/api/projects/get-list-projects/`, {
            params: { token_user: token },
        });
    } catch (error) {
        console.error('Error listing projects (legacy):', error);
    }
}

async function delete_project_by_id(id: string): Promise<any> {
    try {
        localStorage.removeItem('treeLeaf_' + id);
        const token = localStorage.getItem('userId');
        return await axios.get(`${backendUrl}/api/projects/delete-project-by-id/`, {
            params: { id, token_user: token },
        });
    } catch (error) {
        console.error('Error deleting project (legacy):', error);
    }
}

async function get_info_project(id: string): Promise<any> {
    try {
        const token = localStorage.getItem('userId');
        return await axios.get(`${backendUrl}/api/projects/select-project-by-id/`, {
            params: { id, token_user: token },
        });
    } catch (error) {
        console.error('Error fetching project (legacy):', error);
    }
}

async function update_info_project(data: ProjectI, id: string): Promise<any> {
    try {
        const token = localStorage.getItem('userId');
        return await axios.post(`${backendUrl}/api/projects/update-project-by-id/`, {
            data: { ...data, token_user: token, id },
            headers: {
                'Content-Type': 'multipart/form-data',
                Accept: 'application/json',
            },
        });
    } catch (error) {
        console.error('Error updating project (legacy):', error);
    }
}

export {
    // New API
    fetch_project,
    patch_project,
    create_project,
    fetch_projects_list,
    delete_project,
    // Legacy
    create_new_project,
    get_all_list_projects,
    delete_project_by_id,
    get_info_project,
    update_info_project,
};

export type { ProjectI, ProjectEditPayload };
