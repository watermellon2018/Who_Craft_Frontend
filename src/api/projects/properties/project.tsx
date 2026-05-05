import axios from 'axios';

const backendUrl = process.env.REACT_APP_BACKEND_URL;

interface ProjectI {
    genre: string[];
    format: string;
    title: string;
    desc: string;
    annot: string;
    audience: string[];
    image: string;
}

async function create_new_project(data: ProjectI): Promise<any> {
    try {
        const token = localStorage.getItem('userId');
        return await axios.post(`${backendUrl}/api/projects/create/`, {
            data: {
                ...data,
                'token_user': token,
            },
            headers: {
                'Content-Type': 'multipart/form-data',
                'Accept': 'application/json',
            }
        });
    } catch (error) {
        console.error('Error creating project:', error);
    }

}

async function get_all_list_projects(): Promise<any> {
    try {
        const token = localStorage.getItem('userId');
        return await axios.get(`${backendUrl}/api/projects/get-list-projects/`, {
            params: {
                'token_user': token,
            }
        });
    } catch (error) {
        console.error('Error creating project:', error);
    }

}

async function delete_project_by_id(id: string): Promise<any> {
    try {
        // чистим локальное хранилище, этого проекта больше нет
        localStorage.removeItem("treeLeaf_" + id);

        const token = localStorage.getItem('userId');
        return await axios.get(`${backendUrl}/api/projects/delete-project-by-id/`, {
            params: {
                "id": id,
                'token_user': token,
            }
        });
    } catch (error) {
        console.error('Error creating project:', error);
    }

}

async function get_info_project(id: string): Promise<any> {
    try {
        const token = localStorage.getItem('userId');
        return await axios.get(`${backendUrl}/api/projects/select-project-by-id/`, {
            params: {
                "id": id,
                'token_user': token,
            }
        });
    } catch (error) {
        console.error('Error creating project:', error);
    }
}

async function update_info_project(data: ProjectI, id: string): Promise<any> {
    try {
        const token = localStorage.getItem('userId');
        return await axios.post(`${backendUrl}/api/projects/update-project-by-id/`, {
            data: {
                ...data,
                'token_user': token,
                "id": id,
            },
            headers: {
                'Content-Type': 'multipart/form-data',
                'Accept': 'application/json',
            }
        });
    } catch (error) {
        console.error('Error creating project:', error);
    }

}

export { create_new_project,
    get_all_list_projects,
    delete_project_by_id,
    get_info_project,
    update_info_project,
}
