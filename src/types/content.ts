export type AppLanguage = 'en' | 'ar' | 'lg';
export type ThemeMode = 'light' | 'dark' | 'system';

export type UserRole = 'registered_user' | 'scholar';

export type ContentStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'UNPUBLISHED'
  | 'ARCHIVED';

export interface AudioMedia {
  url: string;
  path?: string | null;
  sizeBytes: number;
  durationSeconds: number;
  format: string;
}

export interface DocumentMedia {
  url: string;
  path?: string | null;
  sizeBytes: number;
  format: string;
  documentType: string;
}

export interface TranscriptMedia {
  en: string;
  ar: string;
  lg: string;
  language: string;
}

export interface ContentItem {
  id: string;
  title: string;
  titleAr?: string | null;
  titleLg?: string | null;
  description: string;
  descriptionAr?: string | null;
  descriptionLg?: string | null;
  contentType: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  categoryNameAr?: string | null;
  categoryNameLg?: string | null;
  subcategory?: string | null;
  seriesId?: string | null;
  seriesTitle?: string | null;
  episodeNumber?: number | null;
  speaker: string;
  date: string;
  location?: string | null;
  coverImage?: string | null;
  audio: AudioMedia | null;
  document: DocumentMedia | null;
  transcript: TranscriptMedia | null;
  quranReferences?: string | null;
  tags: string[];
  language: string;
  status: ContentStatus;
  featured: boolean;
  playCount: number;
  downloadCount: number;
  createdBy?: string | null;
  updatedBy?: string | null;
  publishedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  // Optional history fields
  positionSeconds?: number;
  durationSeconds?: number;
  lastPlayedAt?: string;
  scrollPercent?: number;
  lastReadAt?: string;
}

export interface Category {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  nameLg: string;
  description: string;
  sortOrder: number;
  itemCount?: number;
}

export interface SeriesItem {
  id: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  title: string;
  titleAr?: string | null;
  titleLg?: string | null;
  description: string;
  speaker: string;
  coverImage?: string | null;
  episodeCount?: number;
}

export interface QASubmission {
  id: string;
  userId?: string | null;
  userName: string;
  questionText: string;
  categoryId: string;
  topic: string;
  status: 'PENDING' | 'IN_REVIEW' | 'ANSWERED' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED';
  answerText?: string | null;
  answerAudioUrl?: string | null;
  answerAudioPath?: string | null;
  answerAudioDuration?: number | null;
  answerAudioSize?: number | null;
  answerDocumentUrl?: string | null;
  answerDocumentPath?: string | null;
  answerDocumentSize?: number | null;
  scholarName?: string | null;
  contentId?: string | null;
  reviewedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  preferredLanguage: AppLanguage;
  themePreference: ThemeMode;
  notificationPrefs: Record<string, boolean>;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  categorySlug: string;
  contentId?: string | null;
  sentBy?: string | null;
  createdAt: string;
}

export type AppSection =
  | 'home'
  | 'tafseer'
  | 'hadith'
  | 'speeches'
  | 'qa'
  | 'lectures'
  | 'documents'
  | 'search'
  | 'downloads'
  | 'favorites'
  | 'history'
  | 'profile'
  | 'settings';
