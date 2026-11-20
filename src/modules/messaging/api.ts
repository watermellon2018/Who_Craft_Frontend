import type {
  MessagingChanges,
  MessagingConversation,
  MessagingConversationList,
  MessagingHistory,
  MessagingMutation,
  MessagingUnread,
  MessagingUserList,
} from '../../api/generated/contracts';
import api from '../../api/http';

export interface MessagingRequest {
  generation: number;
  signal?: AbortSignal;
}

function config(request: MessagingRequest) {
  return {expectedAuthGeneration: request.generation, signal: request.signal};
}

const root = 'api/messaging/';
const conversationPath = (id: string) => `${root}conversations/${encodeURIComponent(id)}/`;

export const messagingApi = {
  async users(query: string, offset: number, request: MessagingRequest) {
    const response = await api.get<MessagingUserList>(`${root}users/`, {
      ...config(request), params: {q: query.trim().replace(/^@/, ''), offset, limit: 30},
    });
    return response.data;
  },
  async conversations(offset: number, request: MessagingRequest) {
    const response = await api.get<MessagingConversationList>(`${root}conversations/`, {
      ...config(request), params: {offset, limit: 50},
    });
    return response.data;
  },
  async unread(request: MessagingRequest) {
    const response = await api.get<MessagingUnread>(`${root}unread/`, config(request));
    return response.data;
  },
  async create(recipientId: number, request: MessagingRequest) {
    const response = await api.post<MessagingConversation>(`${root}conversations/`, {
      recipient_id: recipientId,
    }, config(request));
    return response.data;
  },
  async history(id: string, before: number | null, request: MessagingRequest) {
    const response = await api.get<MessagingHistory>(`${conversationPath(id)}messages/`, {
      ...config(request), params: {limit: 50, ...(before === null ? {} : {before})},
    });
    return response.data;
  },
  async changes(id: string, revision: number, request: MessagingRequest) {
    const response = await api.get<MessagingChanges>(`${conversationPath(id)}changes/`, {
      ...config(request), params: {after_revision: revision, limit: 100},
    });
    return response.data;
  },
  async send(id: string, text: string, clientId: string, request: MessagingRequest) {
    const response = await api.post<MessagingMutation>(`${conversationPath(id)}messages/`, {
      text, client_id: clientId,
    }, config(request));
    return response.data;
  },
  async edit(id: string, messageId: number, text: string, version: number, request: MessagingRequest) {
    const response = await api.patch<MessagingMutation>(`${conversationPath(id)}messages/${messageId}/`, {
      text, expected_version: version,
    }, config(request));
    return response.data;
  },
  async remove(id: string, messageId: number, request: MessagingRequest) {
    const response = await api.delete<MessagingMutation>(`${conversationPath(id)}messages/${messageId}/`, config(request));
    return response.data;
  },
  async clear(id: string, request: MessagingRequest) {
    const response = await api.delete<MessagingConversation>(conversationPath(id), config(request));
    return response.data;
  },
  async read(id: string, sequence: number, request: MessagingRequest) {
    const response = await api.post<MessagingConversation>(`${conversationPath(id)}read/`, {
      through_sequence: sequence,
    }, config(request));
    return response.data;
  },
};

export function messagingErrorStatus(error: unknown): number | undefined {
  return (error as {response?: {status?: number}} | null)?.response?.status;
}
