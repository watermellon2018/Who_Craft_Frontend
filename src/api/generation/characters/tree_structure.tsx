import axios from 'axios';

const backendUrl = process.env.REACT_APP_BACKEND_URL;


async function get_all_character_for_project(project_id: number | string): Promise<any> {
    try {
        return await axios.get(`${backendUrl}/api/character/select/`, {
            params: {
                projectId: project_id,
            }
        });
    } catch (error) {
        console.error('Error generating image to image:', error);
    }

}

async function deleteCharacterFromTree(id: string): Promise<any> {
    try {
        return await axios.post(`${backendUrl}/api/character/delete/`, {
            'id': id,
        });
    } catch (error) {
        console.error('Error generating image to image:', error);
    }

}

async function createCharacterFromTreeAPI(
    id: number | string,
    name: string,
    type: 'leaf' | 'node',
    projectId: number | string,
    parentId: string|null = null,
    heroID: string | null = null,
    studioCharacterId: string | null = null,
)
    : Promise<any> {
    try {
        const token = localStorage.getItem('userId');

        return await axios.post(`${backendUrl}/api/character/create/`, {
            'heroID': heroID,
            'id': id,
            'name': name,
            'type': type,
            'parent': parentId,
            'token_user': token,
            'projectId': projectId,
            'studioCharacterId': studioCharacterId,
        });
    } catch (error) {
        console.error('Error generating image to image:', error);
    }

}

async function renameCharacterFromTree(id: string,
                                       name: string
): Promise<any> {
    try {
        return await axios.post(`${backendUrl}/api/character/rename/`, {
            'id': id,
            'name': name,
        });
    } catch (error) {
        console.error('Error generating image to image:', error);
    }

}

export {
    get_all_character_for_project,
    deleteCharacterFromTree,
    createCharacterFromTreeAPI,
    renameCharacterFromTree
};
