export interface ProfileUser {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  cover_url: string | null;
  tagline: string;
  bio: string;
  location: string;
  joined_at: string | null;
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

export interface ProfileSettings {
  language: string;
  private_account: boolean;
  notifications_enabled: boolean;
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
