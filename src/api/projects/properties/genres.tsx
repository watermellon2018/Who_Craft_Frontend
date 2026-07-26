import api from '../../http';

async function get_all_genres(): Promise<any> {
    try {
        return await api.get('api/projects/properties/genre/select/');
    } catch {
        return undefined;
    }
}

export { get_all_genres };
