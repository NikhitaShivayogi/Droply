import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function randomCode(length = 12) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function digest(value, pepper) {
  if (!pepper) throw new Error('Required secret pepper is not configured.');
  return createHmac('sha256', pepper).update(value).digest('hex');
}

export function createAccessCode() {
  return randomCode();
}

export function createManagementSecret() {
  return randomBytes(32).toString('base64url');
}

export function hashCode(code) {
  return digest(code, process.env.CODE_PEPPER);
}

export function hashManagementSecret(secret) {
  return digest(secret, process.env.MANAGEMENT_PEPPER);
}

export function managementSecretMatches(secret, expectedHash) {
  if (typeof secret !== 'string' || secret.length > 100 || !/^[A-Za-z0-9_-]+$/.test(secret) || typeof expectedHash !== 'string') return false;
  const actual = Buffer.from(hashManagementSecret(secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
