import {
  apiRequest,
  apiSession,
  CustomerServiceError,
} from '@/services/apiClient';
import { API_ORIGIN } from '@/services/catalog';
import { mapCustomerOrder } from '@/utils/orders';
import type {
  AuthSession,
  AvatarSelection,
  CustomerOrder,
  GuestSnapshot,
  NotificationPreference,
  NotificationRecord,
  Page,
  ProfileDraft,
  UserAddress,
  UserProfile,
} from '@/types/customer';
export { CustomerServiceError } from '@/services/apiClient';
const publicPost = <T>(action: string, body: unknown) =>
  apiRequest<T>('/api/auth/' + action, { method: 'POST', body, auth: 'none' });
const unavailable = async (): Promise<never> => {
  throw new CustomerServiceError('unavailable');
};
export const authService = {
  available: true,
  login: (email: string, password: string) =>
    publicPost<AuthSession>('login', { email, password }),
  register: (name: string, email: string, password: string, language = 'en') =>
    publicPost<AuthSession>('register', { name, email, password, language }),
  refresh: (refreshToken: string) =>
    publicPost<AuthSession>('refresh', { refreshToken }),
  logout: (refreshToken: string) =>
    publicPost<void>('logout', { refreshToken }),
  logoutAll: async () => {
    await apiRequest('/api/auth/logout-all', { method: 'POST' });
    await apiSession.clear();
  },
  forgotPassword: (email: string) =>
    publicPost<void>('forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    publicPost<void>('reset-password', { token, password }),
  changePassword: async (currentPassword: string, newPassword: string) => {
    await apiRequest('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    });
    await apiSession.clear();
  },
  deleteAccount: (password: string) =>
    apiRequest<void>('/api/me', { method: 'DELETE', body: { password } }),
  requestPhoneCode: (_phone: string) => unavailable(),
  verifyPhoneCode: (_phone: string, _code: string) => unavailable(),
  socialSignIn: (_provider: 'apple' | 'google') => unavailable(),
};
type OrderDTO = Omit<CustomerOrder, 'number' | 'address'> & {
  id: string;
  shippingAddress: CustomerOrder['address'];
};
const orderDTO = (order: OrderDTO): CustomerOrder =>
  mapCustomerOrder(order, API_ORIGIN);
export const customerService = {
  getProfile: async () =>
    (await apiRequest<{ user: UserProfile }>('/api/me')).user,
  updateProfile: async (draft: ProfileDraft) =>
    (
      await apiRequest<{ user: UserProfile }>('/api/me', {
        method: 'PATCH',
        body: draft,
      })
    ).user,
  // The server currently reports avatar_storage_not_configured. Do not upload
  // local photo bytes until a durable storage adapter is configured.
  uploadAvatar: async (_image: AvatarSelection) =>
    (
      await apiRequest<{ user: UserProfile }>('/api/me/avatar', {
        method: 'POST',
      })
    ).user,
  removeAvatar: async () =>
    (
      await apiRequest<{ user: UserProfile }>('/api/me/avatar', {
        method: 'DELETE',
      })
    ).user,
  listAddresses: async () =>
    (await apiRequest<{ addresses: UserAddress[] }>('/api/addresses'))
      .addresses,
  saveAddress: async (address: UserAddress) =>
    (
      await apiRequest<{ addresses: UserAddress[] }>(
        '/api/addresses' +
          (address.id ? '/' + encodeURIComponent(address.id) : ''),
        { method: address.id ? 'PATCH' : 'POST', body: address },
      )
    ).addresses,
  deleteAddress: async (id: string) =>
    (
      await apiRequest<{ addresses: UserAddress[] }>(
        '/api/addresses/' + encodeURIComponent(id),
        { method: 'DELETE' },
      )
    ).addresses,
  orders: async (cursor?: string): Promise<Page<CustomerOrder>> => {
    const page = await apiRequest<Page<OrderDTO>>(
      '/api/me/orders' +
        (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''),
    );
    return { ...page, items: page.items.map(orderDTO) };
  },
  order: async (id: string) =>
    orderDTO(
      (
        await apiRequest<{ order: OrderDTO }>(
          '/api/me/orders/' + encodeURIComponent(id),
        )
      ).order,
    ),
  favorites: async () =>
    (await apiRequest<{ favorites: number[] }>('/api/favorites')).favorites,
  setFavorite: async (id: number, add: boolean) =>
    (
      await apiRequest<{ favorites: number[] }>('/api/favorites/' + id, {
        method: add ? 'POST' : 'DELETE',
      })
    ).favorites,
  mergeFavorites: async (productIds: number[]) =>
    (
      await apiRequest<{ favorites: number[] }>('/api/favorites/merge', {
        method: 'POST',
        body: { productIds },
      })
    ).favorites,
  mergeGuestData: async (snapshot: GuestSnapshot): Promise<GuestSnapshot> => ({
    ...snapshot,
    favorites: await customerService.mergeFavorites(snapshot.favorites),
  }),
  notifications: (cursor?: string) =>
    apiRequest<Page<NotificationRecord>>(
      '/api/notifications' +
        (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''),
    ),
  markNotificationRead: (id: string) =>
    apiRequest<void>('/api/notifications/' + encodeURIComponent(id) + '/read', {
      method: 'PATCH',
    }),
  markAllNotificationsRead: () =>
    apiRequest<void>('/api/notifications/read-all', { method: 'POST' }),
  notificationPreferences: async () =>
    (
      await apiRequest<{ preferences: NotificationPreference }>(
        '/api/notification-preferences',
      )
    ).preferences,
  updateNotificationPreferences: async (
    preferences: NotificationPreference,
  ) => {
    await apiRequest('/api/notification-preferences', {
      method: 'PATCH',
      body: preferences,
    });
  },
};
export function customerError(error: unknown, ar: boolean) {
  const code = error instanceof CustomerServiceError ? error.code : '';
  const messages: Record<string, [string, string]> = {
    invalid_credentials: [
      'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      'Email or password is incorrect.',
    ],
    registration_unavailable: [
      'تعذر إنشاء الحساب بهذه البيانات. جرّب تسجيل الدخول.',
      'Unable to register with these details. Try signing in.',
    ],
    unauthorized: [
      'انتهت الجلسة. سجل الدخول مرة أخرى.',
      'Your session expired. Please sign in again.',
    ],
    weak_password: [
      'استخدم كلمة مرور غير شائعة من 10 أحرف على الأقل.',
      'Use an uncommon password of at least 10 characters.',
    ],
    invalid_reset_token: [
      'رابط إعادة التعيين غير صالح أو انتهت صلاحيته.',
      'This reset link is invalid or expired.',
    ],
    rate_limited: [
      'محاولات كثيرة. حاول مرة أخرى بعد قليل.',
      'Too many attempts. Please try again later.',
    ],
    email_change_requires_verification: [
      'تغيير البريد الإلكتروني غير متاح حاليًا.',
      'Email changes are not currently available.',
    ],
    email_provider_not_configured: [
      'إرسال رسائل استعادة كلمة المرور غير مفعّل بعد.',
      'Password reset email delivery is not configured yet.',
    ],
    avatar_storage_not_configured: [
      'حفظ صورة الحساب غير مفعّل بعد.',
      'Profile photo storage is not configured yet.',
    ],
    unavailable: [
      'الخدمة غير متاحة حاليًا. يمكنك متابعة التسوق كضيف.',
      'This service is currently unavailable. You can shop as a guest.',
    ],
    database_not_configured: [
      'خدمة الحسابات غير جاهزة حاليًا. يمكنك التسوق كضيف.',
      'Accounts are not configured yet. You can shop as a guest.',
    ],
  };
  return (
    messages[code]?.[ar ? 0 : 1] ||
    (ar
      ? 'تعذر إكمال الطلب. تحقق من الاتصال وحاول مرة أخرى.'
      : 'Unable to complete the request. Check your connection and try again.')
  );
}
