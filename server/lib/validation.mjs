export const fail = (statusCode, code) =>
  Object.assign(new Error(code), { statusCode, code });
export function text(value, max = 120, required = false) {
  if (
    typeof value !== 'string' ||
    value.trim().length > max ||
    (required && !value.trim())
  )
    throw fail(400, 'invalid_input');
  return value.trim();
}
export function email(value) {
  const result = text(value, 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(result))
    throw fail(400, 'invalid_input');
  return result;
}
export function phone(value = '') {
  let result = text(value, 30)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[\s().-]/g, '');
  if (!result) return '';
  if (result.startsWith('00')) result = '+' + result.slice(2);
  if (/^0[2-9]\d{7,8}$/.test(result)) result = '+971' + result.slice(1);
  else if (/^971\d+$/.test(result)) result = '+' + result;
  result = result.replace(/^\+9710/, '+971');
  if (!/^\+[1-9]\d{7,14}$/.test(result)) throw fail(400, 'invalid_input');
  return result;
}
export function password(value) {
  if (
    typeof value !== 'string' ||
    value.length < 10 ||
    value.length > 128 ||
    !value.trim() ||
    /^(password|1234567890|qwerty|abcdefghij|0000000000)/i.test(value)
  )
    throw fail(400, 'weak_password');
  return value;
}
export function uuid(value) {
  if (
    typeof value !== 'string' ||
    !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
  )
    throw fail(404, 'not_found');
  return value;
}
export function page(url) {
  const offset = Number(url.searchParams.get('cursor') || 0),
    limit = Number(url.searchParams.get('limit') || 20);
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 100000 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50
  )
    throw fail(400, 'invalid_cursor');
  return { offset, limit };
}
export const pageResult = (rows, { offset, limit }) => ({
  items: rows.slice(0, limit),
  nextCursor: rows.length > limit ? String(offset + limit) : undefined,
});
export function address(value) {
  const category = value.category || 'other';
  if (!['home', 'farm', 'company', 'other'].includes(category))
    throw fail(400, 'invalid_input');
  return {
    label: text(value.label, 80, true),
    category,
    name: text(value.name || '', 120),
    phone: phone(value.phone || ''),
    emirate: text(value.emirate, 60, true),
    city: text(value.city, 100, true),
    addressLine: text(value.addressLine, 180, true),
    unit: text(value.unit || '', 30),
    notes: text(value.notes || '', 300),
    isDefault: value.isDefault === true,
  };
}
