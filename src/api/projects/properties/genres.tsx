import type {AxiosResponse} from 'axios';

import api from '../../http';

async function get_all_genres(): Promise<AxiosResponse<unknown>> {
  return api.get<unknown>('api/projects/properties/genre/select/');
}

export {get_all_genres};
