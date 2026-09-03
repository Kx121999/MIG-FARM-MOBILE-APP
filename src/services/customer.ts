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

export class CustomerServiceError extends Error {
  constructor(
    public code:
      | 'unavailable'
      | 'network'
      | 'invalid'
      | 'unauthorized'
      | 'storage',
  ) {
    super(code);
  }
}
export interface AuthService {
  readonly available: boolean;
  login(email: string, password: string): Promise<AuthSession>;
  register(
    name: string,
    email: string,
    password: string,
  ): Promise<AuthSession | { verificationRequired: true }>;
  requestPhoneCode(phone: string): Promise<void>;
  verifyPhoneCode(phone: string, code: string): Promise<AuthSession>;
  forgotPassword(email: string): Promise<void>;
  refresh(refreshToken: string): Promise<AuthSession>;
  logout(refreshToken: string): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  deleteAccount(password: string): Promise<void>;
  socialSignIn(provider: 'apple' | 'google'): Promise<AuthSession>;
}
export interface CustomerService {
  getProfile(): Promise<UserProfile>;
  updateProfile(draft: ProfileDraft): Promise<UserProfile>;
  uploadAvatar(image: AvatarSelection): Promise<UserProfile>;
  removeAvatar(): Promise<UserProfile>;
  listAddresses(): Promise<UserAddress[]>;
  saveAddress(address: UserAddress): Promise<UserAddress[]>;
  deleteAddress(id: string): Promise<UserAddress[]>;
  orders(cursor?: string): Promise<Page<CustomerOrder>>;
  order(number: string): Promise<CustomerOrder>;
  favorites(): Promise<number[]>;
  mergeGuestData(snapshot: GuestSnapshot): Promise<GuestSnapshot>;
  notifications(cursor?: string): Promise<Page<NotificationRecord>>;
  markNotificationRead(id: string): Promise<void>;
  updateNotificationPreferences(
    preferences: NotificationPreference,
  ): Promise<void>;
}
// The inspected Render backend exposes no customer endpoints. No speculative
// password uploads or mock-success responses are permitted in this adapter.
const unavailable = async (): Promise<never> => {
  throw new CustomerServiceError('unavailable');
};
export const authService: AuthService = {
  available: false,
  login: unavailable,
  register: unavailable,
  requestPhoneCode: unavailable,
  verifyPhoneCode: unavailable,
  forgotPassword: unavailable,
  refresh: unavailable,
  logout: unavailable,
  changePassword: unavailable,
  deleteAccount: unavailable,
  socialSignIn: unavailable,
};
export const customerService: CustomerService = {
  getProfile: unavailable,
  updateProfile: unavailable,
  uploadAvatar: unavailable,
  removeAvatar: unavailable,
  listAddresses: unavailable,
  saveAddress: unavailable,
  deleteAddress: unavailable,
  orders: unavailable,
  order: unavailable,
  favorites: unavailable,
  mergeGuestData: unavailable,
  notifications: unavailable,
  markNotificationRead: unavailable,
  updateNotificationPreferences: unavailable,
};
export function customerError(error: unknown, ar: boolean) {
  if (error instanceof CustomerServiceError && error.code === 'unavailable')
    return ar
      ? 'الخدمة غير متاحة حاليًا. يمكنك متابعة التسوق كضيف.'
      : 'This service is currently unavailable. You can continue shopping as a guest.';
  if (error instanceof CustomerServiceError && error.code === 'unauthorized')
    return ar
      ? 'انتهت الجلسة. سجل الدخول مرة أخرى.'
      : 'Your session expired. Please sign in again.';
  return ar
    ? 'تعذر إكمال الطلب. تحقق من الاتصال وحاول مرة أخرى.'
    : 'Unable to complete the request. Check your connection and try again.';
}
