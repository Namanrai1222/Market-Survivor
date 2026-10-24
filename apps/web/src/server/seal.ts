// Seed encryption at rest (legal review L-13, security.md T-10). AES-256-GCM, one random IV per write.
// The key comes from MS_SEED_KEY (32 bytes, base64 or hex). Development falls back to a fixed key with a
// warning; production refuses to start a write without a real key.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1:';
let warned = false;

function key(): Buffer {
  const raw = process.env.MS_SEED_KEY;
  if (raw) {
    const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (buf.length !== 32) throw new Error('MS_SEED_KEY must be 32 bytes (64 hex chars or base64)');
    return buf;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('MS_SEED_KEY is required in production');
  if (!warned) {
    warned = true;
    console.warn('[ms] MS_SEED_KEY not set: using the development seed key. Set it before deploying.');
  }
  return createHash('sha256').update('market-survivor-dev-seed-key').digest();
}

export const isSealed = (v: string): boolean => v.startsWith(PREFIX);

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}

/** Opens a sealed value; plain (pre-encryption) values pass through so old saves keep working. */
export function unseal(value: string): string {
  if (!isSealed(value)) return value;
  const buf = Buffer.from(value.slice(PREFIX.length), 'base64');
  const d = createDecipheriv('aes-256-gcm', key(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
}
