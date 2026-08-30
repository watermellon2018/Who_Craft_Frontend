export interface ProfileUser {
  id: number;
  username: string;
  effective_username: string;
  display_name: string;
  avatar_url: string | null;
  cover_url: string | null;
  tagline: string;
  bio: string;
  location: string;
  joined_at: string | null;
  subscribers_count: number;
}

export interface ProfileCompletion {
  percent: number;
  items: {
    avatar: boolean;
    about: boolean;
    interests: boolean;
    socials: boolean;
  };
}

export interface ProfileStats {
  available?: boolean;
  new_messages: number;
  subscriptions_count: number;
  watch_history_count: number;
  total_views: number;
  recommendations_count: number;
  completed_lessons: number;
}

export interface Award {
  code: string;
  title: string;
  description: string;
  unlocked: boolean;
}

export interface AnalyticsPoint {
  date: string;
  views: number;
}

export interface AnalyticsSummary {
  views: number;
  views_delta_percent: number;
  unique_viewers: number;
  unique_viewers_delta_percent: number;
  average_watch_time: string;
  average_watch_time_delta_percent: number;
}

export interface ViewsAnalytics {
  available?: boolean;
  period: string;
  points: AnalyticsPoint[];
  summary: AnalyticsSummary;
}

export interface ActivityItem {
  type: string;
  text: string;
  created_at: string;
}

export interface FavoriteAuthor {
  id: number;
  name: string;
  avatar_url: string | null;
  subscribers_count: number;
  is_subscribed: boolean;
}

export interface ContinueWatchingItem {
  id: number;
  title: string;
  thumbnail_url: string | null;
  duration: string;
  progress_percent: number;
  continue_from: string;
}

export type ProfileLanguage = 'en' | 'ru';
export type CommentPermission = 'everyone' | 'followers' | 'nobody';

export interface ProfileSettings {
  language: ProfileLanguage;
  content_language: ProfileLanguage;
  private_account: boolean;
  notifications_in_app: boolean;
  notifications_email: boolean;
  comment_permission: CommentPermission;
}

export interface SocialLinks {
  telegram: string;
  instagram: string;
  youtube: string;
  website: string;
}

export interface SocialLinkItem {
  platform: string;
  url: string;
  display_order?: number;
}

export interface ProfileEditSettings {
  private_account: boolean;
  show_in_recommendations: boolean;
  show_activity: boolean;
}

export interface ProfileEditFormState {
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  cover_url: string | null;
  interests: string[];
  socials: SocialLinks;
  settings: ProfileEditSettings;
  language: 'ru' | 'en';
}

export interface DashboardData {
  user: ProfileUser;
  profile_completion: ProfileCompletion;
  stats: ProfileStats;
  awards: Award[];
  interests: string[];
  favorite_genres: string[];
  views_analytics: ViewsAnalytics;
  recent_activity: ActivityItem[];
  favorite_authors: FavoriteAuthor[];
  continue_watching: ContinueWatchingItem[];
  settings: ProfileSettings;
}
