export type Role = 'STUDENT' | 'ADMIN';

export interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  phone: string | null;
  role: Role;
}

export interface SessionState {
  user: User | null;
  providers: { google: boolean; email: boolean };
}

export interface Author {
  id: string;
  name: string;
  image: string | null;
}

export interface Resource {
  id: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileType: string;
}

export interface CourseSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceInr: number;
  thumbnailUrl: string | null;
  availableFrom: string | null;
  freePreviewFirstLesson: boolean;
  lessonCount: number;
  totalDurationSec: number;
  studentCount: number;
  isEnrolled: boolean;
  awaitingLicense: boolean;
}

export interface CourseDetail
  extends Omit<CourseSummary, 'isEnrolled' | 'awaitingLicense'> {
  isPublished: boolean;
}

export interface Lesson {
  id: string;
  title: string;
  descriptionHtml: string;
  order: number;
  durationSec: number;
  videoUrl: string | null;
  isLocked: boolean;
  isCompleted: boolean;
  progressPercent: number;
  resources: Resource[];
}

export type LessonStub = Omit<Lesson, 'videoUrl' | 'descriptionHtml'>;

export interface CourseProgress {
  total: number;
  completed: number;
  percent: number;
  nextLessonId: string | null;
}

export interface CourseAccess {
  hasAccess: boolean;
  isEnrolled: boolean;
  awaitingLicense: boolean;
  pendingPayment: { id: string; transactionRef: string; createdAt: string } | null;
}

export interface CoursePageData {
  course: CourseDetail;
  lessons: Lesson[];
  progress: CourseProgress;
  access: CourseAccess;
}

export interface TimestampComment {
  id: string;
  timestamp: number;
  text: string;
  createdAt: string;
  author: Author;
  likeCount: number;
  likedByMe: boolean;
  isMine: boolean;
  canDelete: boolean;
  replies: TimestampComment[];
}

export interface ClassroomData {
  course: { id: string; slug: string; title: string };
  lesson: Lesson;
  lessons: LessonStub[];
  progress: CourseProgress;
  access: { hasAccess: boolean; isSignedIn: boolean };
  comments: TimestampComment[];
}

export interface DashboardCourse {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  priceInr: number;
  lessonCount: number;
  totalDurationSec: number;
  completedLessons: number;
  percent: number;
  isActive: boolean;
  awaitingLicense: boolean;
  paymentUnderReview: boolean;
  activatedAt: string | null;
}

export interface GiftSummary {
  id: string;
  code: string;
  amountInr: number;
  isRedeemed: boolean;
  redeemedAt: string | null;
  createdAt: string;
  course: { title: string; slug: string; thumbnailUrl?: string | null };
}

export interface DashboardData {
  courses: DashboardCourse[];
  unreadNotifications: number;
  gifts: GiftSummary[];
}

export type ReactionType = 'LIKE' | 'FIRE' | 'CLAP';

export interface CommunityComment {
  id: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  author: Author;
  isMine: boolean;
  canDelete: boolean;
}

export interface CommunityPost {
  id: string;
  title: string;
  caption: string;
  mediaUrl: string | null;
  createdAt: string;
  author: Author;
  isMine: boolean;
  canDelete: boolean;
  reactions: Array<{ type: ReactionType; count: number; mine: boolean }>;
  comments: CommunityComment[];
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  actor: Author | null;
  course: { slug: string; title: string } | null;
  postId: string | null;
  videoId: string | null;
}

export interface TrendingPrompt {
  id: string;
  title: string;
  prompt: string;
  imageUrl: string;
  sortOrder: number;
  isPublished: boolean;
}

export interface PaymentConfig {
  razorpayEnabled: boolean;
  razorpayKeyId: string | null;
  qrCodeUrl: string | null;
}

/* ---------- studio ---------- */

export interface StudioBalance {
  availableCredits: number;
  lifetimePurchasedCredits: number;
  lifetimeUsedCredits: number;
}

export interface StudioPack {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  amountInr: number;
}

export interface StudioModel {
  id: string;
  providerModelId: string;
  displayName: string;
  category: string;
  providerCredits: number;
}

export interface StudioGeneration {
  id: string;
  prompt: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
  creditsCharged: number;
  outputUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
  modelPricing: { displayName: string; category: string } | null;
}

export interface StudioLedgerEntry {
  id: string;
  type: 'PURCHASE' | 'GENERATION_DEBIT' | 'REFUND' | 'ADMIN_ADJUSTMENT';
  deltaCredits: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
}

export interface StudioOverview {
  brand: string;
  balance: StudioBalance;
  packs: StudioPack[];
  models: StudioModel[];
  ledger: StudioLedgerEntry[];
  purchases: Array<{
    id: string;
    amountInr: number;
    credits: number;
    status: string;
    createdAt: string;
    pack: { name: string } | null;
  }>;
  generations: StudioGeneration[];
}

/* ---------- admin ---------- */

export interface AdminStats {
  courses: number;
  publishedCourses: number;
  lessons: number;
  resources: number;
  activeStudents: number;
  pendingPayments: number;
  unpaidCheckouts: number;
  completionRate: number;
  revenueInr: number;
  studioCreditsOutstanding: number;
}

export interface AdminCourseCard {
  id: string;
  slug: string;
  title: string;
  priceInr: number;
  isPublished: boolean;
  thumbnailUrl: string | null;
  lessonCount: number;
  studentCount: number;
}

export interface AdminPayment {
  id: string;
  amountInr: number;
  transactionRef: string;
  note: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  method?: 'gateway' | 'manual';
  isGift: boolean;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  user: { id: string; name: string | null; email: string | null; phone: string | null };
  course: { title: string; slug: string; priceInr: number };
}

export interface AdminOverview {
  stats: AdminStats;
  courses: AdminCourseCard[];
  recentPayments: AdminPayment[];
  recentDoubts: Array<{
    id: string;
    text: string;
    timestamp: number;
    createdAt: string;
    user: { name: string | null; email: string | null };
    video: { title: string; order: number; course: { title: string; slug: string } };
  }>;
}

export interface AdminLessonRow {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  order: number;
  durationSec: number;
}

export interface AdminCourseFull {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceInr: number;
  thumbnailUrl: string | null;
  availableFrom: string | null;
  freePreviewFirstLesson: boolean;
  isPublished: boolean;
  videos: AdminLessonRow[];
  resources: Array<Resource & { videoId: string | null; courseId: string }>;
  _count: { enrollments: number };
}

export interface AdminStudent {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  joinedAt: string;
  studioCredits: number;
  lastActivity: string;
  latestPayment: { status: string; amountInr: number; course: { title: string } } | null;
  courses: Array<{
    id: string;
    title: string;
    slug: string;
    isActive: boolean;
    awaitingLicense: boolean;
    percent: number;
  }>;
}

export interface AdminStudioPack {
  id: string;
  name: string;
  credits: number;
  amountInr: number;
  providerCostInr: number;
  isActive: boolean;
}

export interface AdminStudioModel {
  id: string;
  displayName: string;
  category: string;
  providerCredits: number;
  isEnabled: boolean;
}

export interface AdminStudioPurchase {
  id: string;
  amountInr: number;
  credits: number;
  status: string;
  createdAt: string;
  user: { name: string | null; email: string | null };
  pack: { name: string } | null;
}

export interface AdminStudioGeneration {
  id: string;
  prompt: string;
  status: string;
  creditsCharged: number;
  createdAt: string;
  user: { name: string | null; email: string | null };
  modelPricing: { displayName: string } | null;
}

export interface AdminStudioData {
  settings: Array<{ key: string; hasValue: boolean; updatedAt: string }>;
  packs: AdminStudioPack[];
  models: AdminStudioModel[];
  purchases: AdminStudioPurchase[];
  generations: AdminStudioGeneration[];
}

export interface AdminCommunityData {
  doubts: Array<{
    id: string;
    text: string;
    timestamp: number;
    createdAt: string;
    user: { name: string | null; email: string | null };
    video: { title: string; order: number; course: { title: string; slug: string } };
  }>;
  posts: Array<{
    id: string;
    title: string;
    caption: string;
    mediaUrl: string | null;
    createdAt: string;
    user: { name: string | null; email: string | null; image: string | null };
    course: { title: string; slug: string };
    _count: { comments: number; reactions: number };
  }>;
}

export interface LeaderboardRow extends Author {
  completedLessons: number;
  totalLessons: number;
  percent: number;
  posts: number;
  isMe: boolean;
}

export interface Leaderboard {
  rows: LeaderboardRow[];
  myRank: number | null;
}
