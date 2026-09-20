import type {
  AdminCourseFull,
  AdminOverview,
  AdminPayment,
  AdminStudent,
  ClassroomData,
  CommunityPost,
  CourseSummary,
  CoursePageData,
  DashboardData,
  GiftSummary,
  NotificationItem,
  PaymentConfig,
  SessionState,
  StudioOverview,
  TimestampComment,
  TrendingPrompt,
  User
} from './types';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function csrfToken(): string | null {
  const match = document.cookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith('academy_csrf='));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}

export async function request<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...((options.headers as Record<string, string>) ?? {})
  };

  const token = csrfToken();
  if (token) headers['X-CSRF-Token'] = token;

  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers
  });

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const body = payload as { error?: string; code?: string; details?: unknown } | null;
    throw new ApiError(
      body?.error ?? `Request failed (${response.status})`,
      response.status,
      body?.code,
      body?.details
    );
  }
  return payload as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body ?? {})
  });
const patch = <T>(path: string, body?: unknown) =>
  request<T>(path, {
    method: 'PATCH',
    body: body instanceof FormData ? body : JSON.stringify(body ?? {})
  });
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });

export const api = {
  auth: {
    session: () => get<SessionState>('/auth/session'),
    register: (body: { name: string; email: string; password: string; phone?: string }) =>
      post<{ user: User }>('/auth/register', body),
    signIn: (body: { email: string; password: string }) =>
      post<{ user: User }>('/auth/sign-in', body),
    signOut: () => post<{ ok: true }>('/auth/sign-out'),
    requestLoginLink: (email: string) => post<{ ok: true }>('/auth/login-link', { email }),
    consumeLoginLink: (body: { email: string; token: string }) =>
      post<{ user: User }>('/auth/login-link/consume', body),
    updateProfile: (body: { name: string; phone?: string; image?: string }) =>
      patch<{ user: User }>('/auth/profile', body),
    changePassword: (body: { currentPassword?: string; newPassword: string }) =>
      post<{ ok: true }>('/auth/password', body)
  },

  courses: {
    list: () => get<{ courses: CourseSummary[] }>('/courses'),
    detail: (slug: string) => get<CoursePageData>(`/courses/${slug}`),
    classroom: (slug: string, lessonId: string) =>
      get<ClassroomData>(`/courses/${slug}/lessons/${lessonId}`),
    dashboard: () => get<DashboardData>('/courses/me/dashboard'),
    saveProgress: (body: { videoId: string; progressPercent: number; isCompleted?: boolean }) =>
      post<{ progress: unknown }>('/courses/progress', body),
    activateLicense: (body: { courseId: string; licenseCode: string }) =>
      post<{ ok: true }>('/courses/license/activate', body),
    trendingPrompts: () => get<{ prompts: TrendingPrompt[] }>('/courses/prompts/trending')
  },

  comments: {
    create: (body: { videoId: string; parentId?: string; timestamp: number; text: string }) =>
      post<{ comment: TimestampComment }>('/comments', body),
    like: (id: string) => post<{ liked: boolean; likeCount: number }>(`/comments/${id}/like`),
    remove: (id: string) => del<{ ok: true }>(`/comments/${id}`)
  },

  community: {
    posts: (courseId: string) =>
      get<{ posts: CommunityPost[] }>(`/community/posts?courseId=${encodeURIComponent(courseId)}`),
    createPost: (body: FormData) => post<{ post: CommunityPost }>('/community/posts', body),
    removePost: (id: string) => del<{ ok: true }>(`/community/posts/${id}`),
    comment: (body: { postId: string; parentId?: string; content: string }) =>
      post<{ comment: CommunityPost['comments'][number] }>('/community/comments', body),
    react: (body: { postId: string; type: 'LIKE' | 'FIRE' | 'CLAP' }) =>
      post<{ active: boolean }>('/community/reactions', body)
  },

  notifications: {
    list: () => get<{ items: NotificationItem[]; unreadCount: number }>('/notifications'),
    markRead: (notificationId: string) => patch<{ ok: true }>('/notifications', { notificationId }),
    markAllRead: () => patch<{ ok: true }>('/notifications', { markAll: true })
  },

  payments: {
    config: () => get<PaymentConfig>('/payments/config'),
    createOrder: (body: { courseId: string; isGift?: boolean }) =>
      post<{
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
        courseTitle: string;
      }>('/payments/order', body),
    verify: (body: {
      courseId: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }) => post<{ ok: true; redirectTo: string }>('/payments/verify', body),
    paymentLink: (courseId: string) =>
      post<{ paymentUrl: string }>('/payments/payment-link', { courseId }),
    submitRequest: (body: { courseId: string; transactionRef: string; note?: string }) =>
      post<{ paymentRequest: unknown }>('/payments/requests', body),
    gift: (id: string) => get<{ gift: GiftSummary & { redeemUrl: string } }>(`/payments/gifts/${id}`),
    redeemGift: (code: string) =>
      post<{ ok: true; redirectTo: string }>('/payments/gifts/redeem', { code })
  },

  studio: {
    overview: () => get<StudioOverview>('/studio/overview'),
    generations: () => get<Pick<StudioOverview, 'generations' | 'balance'>>('/studio/generations'),
    createCreditOrder: (packId: string) =>
      post<{
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
        description: string;
      }>('/studio/credits/order', { packId }),
    verifyCredits: (body: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }) => post<{ ok: true; balance: number }>('/studio/credits/verify', body),
    generate: (body: { providerModelId: string; prompt: string; workflowId?: string }) =>
      post<{ ok: true; balance: number }>('/studio/generate', body)
  },

  admin: {
    overview: () => get<AdminOverview>('/admin/overview'),
    courses: () => get<{ courses: AdminCourseFull[] }>('/admin/courses'),
    createCourse: (body: FormData) => post<{ course: AdminCourseFull }>('/admin/courses', body),
    updateCourse: (id: string, body: FormData) =>
      patch<{ course: AdminCourseFull }>(`/admin/courses/${id}`, body),
    publishCourse: (id: string, isPublished: boolean) =>
      post<{ course: AdminCourseFull }>(`/admin/courses/${id}/publish`, { isPublished }),
    deleteCourse: (id: string) => del<{ ok: true }>(`/admin/courses/${id}`),

    lessons: () =>
      get<{
        courses: Array<{ id: string; slug: string; title: string; lessons: AdminCourseFull['videos'] }>;
        resources: AdminCourseFull['resources'];
      }>('/admin/lessons'),
    createLesson: (body: FormData) => post<{ lesson: unknown }>('/admin/lessons', body),
    updateLesson: (id: string, body: FormData) => patch<{ lesson: unknown }>(`/admin/lessons/${id}`, body),
    deleteLesson: (id: string) => del<{ ok: true }>(`/admin/lessons/${id}`),

    createResource: (body: FormData) => post<{ resource: unknown }>('/admin/resources', body),
    deleteResource: (id: string) => del<{ ok: true }>(`/admin/resources/${id}`),

    students: () => get<{ students: AdminStudent[] }>('/admin/students'),
    grantCourse: (studentId: string, courseId: string) =>
      post<{ ok: true }>(`/admin/students/${studentId}/grant`, { courseId }),
    revokeCourse: (studentId: string, courseId: string) =>
      post<{ ok: true }>(`/admin/students/${studentId}/revoke`, { courseId }),

    payments: () => get<{ payments: AdminPayment[] }>('/admin/payments'),
    approvePayment: (id: string) =>
      post<{ ok: true; licenseCode: string; emailed: boolean }>(`/admin/payments/${id}/approve`),
    rejectPayment: (id: string) => post<{ ok: true }>(`/admin/payments/${id}/reject`),

    prompts: () => get<{ prompts: TrendingPrompt[] }>('/admin/prompts'),
    createPrompt: (body: FormData) => post<{ prompt: TrendingPrompt }>('/admin/prompts', body),
    setPromptPublished: (id: string, isPublished: boolean) =>
      patch<{ prompt: TrendingPrompt }>(`/admin/prompts/${id}`, { isPublished }),
    deletePrompt: (id: string) => del<{ ok: true }>(`/admin/prompts/${id}`),

    community: () => get<{ doubts: unknown[]; posts: unknown[] }>('/admin/community'),

    studio: () =>
      get<{
        settings: Array<{ key: string; hasValue: boolean; updatedAt: string }>;
        packs: unknown[];
        models: unknown[];
        purchases: unknown[];
        generations: unknown[];
      }>('/admin/studio'),
    saveStudioSetting: (key: string, value: string) =>
      post<{ ok: true }>('/admin/studio/settings', { key, value }),
    allocateCredits: (body: { email: string; credits: number; note?: string }) =>
      post<{ ok: true; balance: number }>('/admin/studio/credits', body)
  }
};

/** Turns any thrown value into a message worth showing a person. */
export function errorMessage(error: unknown, fallback = 'Something went wrong.') {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
