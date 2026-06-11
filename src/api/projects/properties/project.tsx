import { AxiosResponse } from 'axios';

import api from '../../http';

// Token is attached as X-User-Token by api/http.ts. Do not pass token_user
// in query params or body — query strings leak to logs/Referer.

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

// ---- New API (preferred) ----

async function fetch_project(projectId: string | number): Promise<AxiosResponse<any>> {
    return api.get(`api/projects/${projectId}/`);
}

async function patch_project(
    projectId: string | number,
    payload: ProjectEditPayload,
): Promise<AxiosResponse<any>> {
    return api.patch(`api/projects/${projectId}/`, payload, {
        headers: { 'Content-Type': 'application/json' },
    });
}

async function create_project(payload: ProjectEditPayload): Promise<AxiosResponse<any>> {
    return api.post('api/projects/', payload, {
        headers: { 'Content-Type': 'application/json' },
    });
}

async function fetch_projects_list(): Promise<AxiosResponse<any>> {
    return api.get('api/projects/');
}

async function delete_project(projectId: string | number): Promise<AxiosResponse<any>> {
    localStorage.removeItem('treeLeaf_' + projectId);
    return api.delete(`api/projects/${projectId}/`);
}

// ---- Legacy wrappers (kept so existing pages don't break) ----

async function create_new_project(data: ProjectI): Promise<any> {
    try {
        return await api.post('api/projects/create/', { data });
    } catch (error) {
        // Don't log the raw error — axios errors embed request bodies.
        return undefined;
    }
}

async function get_all_list_projects(): Promise<any> {
    try {
        return await api.get('api/projects/get-list-projects/');
    } catch (error) {
        return undefined;
    }
}

async function delete_project_by_id(id: string): Promise<any> {
    try {
        localStorage.removeItem('treeLeaf_' + id);
        // Backend's legacy endpoint now requires DELETE/POST (GET was CSRF-vulnerable).
        return await api.delete('api/projects/delete-project-by-id/', { params: { id } });
    } catch (error) {
        return undefined;
    }
}

async function get_info_project(id: string): Promise<any> {
    try {
        return await api.get('api/projects/select-project-by-id/', { params: { id } });
    } catch (error) {
        return undefined;
    }
}

async function update_info_project(data: ProjectI, id: string): Promise<any> {
    try {
        return await api.post('api/projects/update-project-by-id/', {
            data: { ...data, id },
        });
    } catch (error) {
        return undefined;
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
