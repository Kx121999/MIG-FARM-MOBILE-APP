import { fail } from '../lib/validation.mjs';

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

const uploadViaSignedEndpoint = async (kind, payload = {}) => {
  const endpoint = process.env.OBJECT_STORAGE_UPLOAD_URL;
  const publicUrl = kind === 'avatar' ? process.env.AVATAR_STORAGE_PUBLIC_URL : process.env.BANNER_STORAGE_PUBLIC_URL;
  if (!endpoint || !publicUrl) throw fail(503, `${kind}_storage_not_configured`);
  const { userId, fileName, contentType, base64 } = payload;
  const key = `${kind}/${userId || 'admin'}/${Date.now()}-${String(fileName || 'image.jpg').replace(/[^A-Za-z0-9._-]/g, '-')}`;
  await jsonPost(
    endpoint,
    { Authorization: process.env.OBJECT_STORAGE_UPLOAD_TOKEN ? `Bearer ${process.env.OBJECT_STORAGE_UPLOAD_TOKEN}` : '' },
    { key, contentType, base64 },
  );
  return { url: `${publicUrl.replace(/\/+$/, '')}/${key}` };
};

export const avatarStorage = {
  get available() {
    return Boolean(process.env.OBJECT_STORAGE_UPLOAD_URL && process.env.AVATAR_STORAGE_PUBLIC_URL);
  },
  async upload(input) {
    if (!this.available) throw fail(503, 'avatar_storage_not_configured');
    return uploadViaSignedEndpoint('avatar', input);
  },
  async remove() {
    return { ok: true };
  },
};

export const bannerStorage = {
  get available() {
    return Boolean(process.env.OBJECT_STORAGE_UPLOAD_URL && process.env.BANNER_STORAGE_PUBLIC_URL);
  },
  async upload(input) {
    if (!this.available) throw fail(503, 'banner_storage_not_configured');
    return uploadViaSignedEndpoint('banner', input);
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
