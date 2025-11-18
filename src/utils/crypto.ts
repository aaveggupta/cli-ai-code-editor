import crypto from 'crypto';

export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateId(): string {
  return crypto.randomBytes(16).toString('hex');
}
