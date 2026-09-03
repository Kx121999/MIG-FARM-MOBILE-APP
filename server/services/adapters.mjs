import { fail } from '../lib/validation.mjs';
// Supply reviewed provider implementations here; no fake delivery or local avatar storage.
export const emailDelivery = {
  available: false,
  async sendPasswordReset() {
    throw fail(503, 'email_provider_not_configured');
  },
};
export const avatarStorage = {
  available: false,
  async upload() {
    throw fail(503, 'avatar_storage_not_configured');
  },
  async remove() {
    throw fail(503, 'avatar_storage_not_configured');
  },
};
