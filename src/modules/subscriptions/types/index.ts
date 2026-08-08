export interface Channel {
  id: number;
  name: string;
  username: string;
  subscribers: string;
  avatarUrl?: string | null;
  avatarFallback: string;
  isSubscribed: boolean;
  notificationsEnabled: boolean;
  isFavorite: boolean;
}
