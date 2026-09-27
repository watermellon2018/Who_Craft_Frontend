import api, {getAuthGeneration} from '../../../api/http';
import {createGeneratedApiClient} from '../../../api/generated/client';
import type {
  GenerationModality,
  GenerationSource,
  PersonalApiConnectionCreate,
  PersonalApiConnectionUpdate,
  PersonalApiPreferenceUpdate,
  PersonalApiSettings,
} from '../../../api/generated/contracts';

export type {
  GenerationModality,
  GenerationSource,
  PersonalApiConnection,
  PersonalApiModel,
  PersonalApiPreference,
  PersonalApiProvider,
  PersonalApiRoute,
  PersonalApiSettings,
} from '../../../api/generated/contracts';

const client = createGeneratedApiClient(api);
export const PERSONAL_API_SETTINGS_CHANGED = 'wcraft:personal-api-settings-changed';

function notifySettingsChanged() {
  window.dispatchEvent(new Event(PERSONAL_API_SETTINGS_CHANGED));
}

export const fetchPersonalApiSettings = () => client.getPersonalApiSettings();

export async function refreshPersonalVideoModels(): Promise<PersonalApiSettings> {
  const response = await api.post<PersonalApiSettings>('api/personal-api/video-models/refresh/', {}, {
    expectedAuthGeneration: getAuthGeneration(),
  });
  notifySettingsChanged();
  return response.data;
}

export async function createPersonalApiConnection(payload: PersonalApiConnectionCreate) {
  const connection = await client.createPersonalApiConnection(payload);
  notifySettingsChanged();
  return connection;
}

export async function updatePersonalApiConnection(id: string, payload: PersonalApiConnectionUpdate) {
  const connection = await client.updatePersonalApiConnection(id, payload);
  notifySettingsChanged();
  return connection;
}

export async function deletePersonalApiConnection(id: string) {
  await client.deletePersonalApiConnection(id);
  notifySettingsChanged();
}

export async function saveGenerationPreference(modality: GenerationModality, payload: PersonalApiPreferenceUpdate) {
  const preference = await client.updatePersonalApiPreference(modality, payload);
  notifySettingsChanged();
  return preference;
}

export function generationModality(domain: string): GenerationModality {
  if (domain === 'text') return 'text';
  if (domain === 'video') return 'video';
  if (domain === 'music') return 'music';
  if (domain === 'sound_effect') return 'sound_effect';
  return 'image';
}

export function preferredGenerationSource(settings: PersonalApiSettings, modality: GenerationModality): GenerationSource {
  return settings.preferences.find((item) => item.modality === modality)?.source ?? 'platform';
}

/** Only configured, active connections and operation-compatible models are candidates. */
export function personalGenerationRoutes(settings: PersonalApiSettings, modality: GenerationModality, operation = 'generate') {
  return (settings.preferences.find((item) => item.modality === modality)?.routes ?? []).flatMap((route) => {
    const connection = settings.connections.find((item) => item.id === route.connectionId && item.isActive);
    const model = settings.models.find((item) => item.key === route.modelKey && item.modality === modality);
    return connection && model && model.providers.includes(connection.provider) && model.operations.includes(operation)
      ? [{...route, connection, model}] : [];
  });
}
