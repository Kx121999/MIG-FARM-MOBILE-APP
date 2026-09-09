import { fail } from '../lib/validation.mjs';
import { createMediaStorage } from './media-storage.mjs';

const jsonPost = async (url, headers, body) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw fail(503, 'provider_request_failed');
  return response.json().catch(() => ({}));
};

export const emailDelivery = {
  get available() {
    return Boolean(process.env.EMAIL_PROVIDER_API_KEY && process.env.EMAIL_FROM);
  },
  async sendPasswordReset(payload = {}) {
    if (!this.available) throw fail(503, 'email_provider_not_configured');
    const { email, url } = payload;
    await jsonPost(
      'https://api.resend.com/emails',
      { Authorization: `Bearer ${process.env.EMAIL_PROVIDER_API_KEY}` },
      {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: 'Reset your MIG FARM password',
        html: `<p>Use this secure link to reset your MIG FARM password:</p><p><a href="${url}">${url}</a></p>`,
      },
    );
  },
};

export const mediaStorage = {
  get available() {
    return createMediaStorage().available;
  },
  status() {
    return createMediaStorage().status();
  },
  ownsKey(key) {
    return createMediaStorage().ownsKey(key);
  },
  upload(input) {
    return createMediaStorage().upload(input);
  },
  remove(input) {
    return createMediaStorage().remove(input);
  },
};

export const avatarStorage = {
  get available() {
    return mediaStorage.available;
  },
  status() {
    return mediaStorage.status();
  },
  async upload(input) {
    if (!this.available) throw fail(503, 'avatar_storage_not_configured');
    return mediaStorage.upload({ file: input.file, purpose: 'avatar' });
  },
  async remove(input = {}) {
    if (!input.key) return { ok: true };
    return mediaStorage.remove(input);
  },
};

export const bannerStorage = {
  get available() {
    return mediaStorage.available;
  },
  status() {
    return mediaStorage.status();
  },
  async upload(input) {
    if (!this.available) throw fail(503, 'banner_storage_not_configured');
    return mediaStorage.upload(input);
  },
  async remove(input = {}) {
    return mediaStorage.remove(input);
  },
};

export const pushDelivery = {
  get available() {
    return Boolean(process.env.EXPO_ACCESS_TOKEN);
  },
  async send(messages) {
    if (!this.available) throw fail(503, 'push_provider_not_configured');
    const chunks = [];
    for (let index = 0; index < messages.length; index += 100)
      chunks.push(messages.slice(index, index + 100));
    const tickets = [];
    for (const chunk of chunks) {
      const result = await jsonPost(
        'https://exp.host/--/api/v2/push/send',
        { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` },
        chunk,
      );
      tickets.push(result);
    }
    return tickets;
  },
};
