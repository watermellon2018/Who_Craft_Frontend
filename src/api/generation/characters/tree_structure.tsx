import api from '../../http';

async function get_all_character_for_project(project_id: number | string): Promise<any> {
    try {
        return await api.get('api/character/select/', {
            params: { projectId: project_id },
        });
    } catch {
        return undefined;
    }
}

async function deleteCharacterFromTree(id: string): Promise<any> {
    try {
        return await api.post('api/character/delete/', { id });
    } catch {
        return undefined;
    }
}

async function createCharacterFromTreeAPI(
    id: number | string,
    name: string,
    type: 'leaf' | 'node',
    projectId: number | string,
    parentId: string | null = null,
    heroID: string | null = null,
    studioCharacterId: string | null = null,
): Promise<any> {
    try {
        return await api.post('api/character/create/', {
            heroID,
            id,
            name,
            type,
            parent: parentId,
            projectId,
            studioCharacterId,
        });
    } catch {
        return undefined;
    }
}

async function renameCharacterFromTree(id: string, name: string): Promise<any> {
    try {
        return await api.post('api/character/rename/', { id, name });
    } catch {
        return undefined;
    }
}

export {
    get_all_character_for_project,
    deleteCharacterFromTree,
    createCharacterFromTreeAPI,
    renameCharacterFromTree,
};
