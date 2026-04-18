import 'reflect-metadata';

import { validate } from './env.validation';

const createValidConfig = (): Record<string, unknown> => ({
  PORT: 3000,
  DB_HOST: 'localhost',
  DB_PORT: 5432,
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'postgres',
  DB_NAME: 'ddd_be',
  NODE_ENV: 'test',
  JWT_SECRET: 'jwt-secret',
  JWT_EXPIRES_IN: '1d',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/callback',
  CLIENT_REDIRECT_URL: 'http://localhost:3001',
  ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  EMAIL_PROVIDER: 'console',
});

describe('env validation', () => {
  it('유효한 ENCRYPTION_KEY면 검증을 통과한다', () => {
    const result = validate(createValidConfig());

    expect(result.ENCRYPTION_KEY).toBe(
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    );
  });

  it('64자리 hex 문자열이 아닌 ENCRYPTION_KEY면 앱 시작 전에 실패한다', () => {
    expect(() => {
      validate({
        ...createValidConfig(),
        ENCRYPTION_KEY: 'invalid-key',
      });
    }).toThrow('ENCRYPTION_KEY must be a 64-character hex string.');
  });
});
