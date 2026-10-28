import { beforeAll, describe, expect, it } from 'vitest';
import { createAccessCode, createManagementSecret, hashCode, hashManagementSecret } from './secrets.js';

beforeAll(() => {
  process.env.CODE_PEPPER = 'test-code-pepper-that-is-not-production';
  process.env.MANAGEMENT_PEPPER = 'test-management-pepper-that-is-not-production';
});

describe('Drop credentials', () => {
  it('generates a high-entropy human-readable access code', () => {
    const code = createAccessCode();
    expect(code).toMatch(/^[2-9A-HJ-NP-Z]{12}$/);
    expect(createAccessCode()).not.toBe(code);
  });

  it('generates a separate management capability and stores only deterministic hashes', () => {
    const code = createAccessCode();
    const secret = createManagementSecret();
    expect(secret).toHaveLength(43);
    expect(hashCode(code)).toBe(hashCode(code));
    expect(hashCode(code)).not.toBe(hashCode(`${code}X`));
    expect(hashManagementSecret(secret)).not.toBe(hashManagementSecret(createManagementSecret()));
    expect(hashCode(code)).not.toBe(hashManagementSecret(code));
  });
});
