import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import Drop from './models/Drop.js';

let app;

beforeAll(() => {
  process.env.CODE_PEPPER = 'test-code-pepper-that-is-not-production';
  process.env.MANAGEMENT_PEPPER = 'test-management-pepper-that-is-not-production';
  ({ app } = createApp());
});

afterEach(() => vi.restoreAllMocks());

describe('API basics', () => {
  it('returns a health response without exposing configuration', async () => {
    const response = await request(app).get('/api/v1/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.body).not.toHaveProperty('environment');
  });

  it('validates Drop creation input before performing work', async () => {
    const response = await request(app).post('/api/v1/drops').send({ files: [] }).expect(400);
    expect(response.body.error.code).toBe('EMPTY_DROP');
  });

  it('does not disclose whether an unknown Drop code exists', async () => {
    vi.spyOn(Drop, 'findOne').mockResolvedValue(null);
    const response = await request(app).post('/api/v1/drops/resolve').send({ code: '23456789ABCD' }).expect(404);
    expect(response.body.error.message).toMatch(/unavailable or has expired/i);
  });
});
