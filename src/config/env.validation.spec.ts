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

  describe('CALENDAR_PROVIDER 조건부 검증', () => {
    it('CALENDAR_PROVIDER 미설정(기본 console)이면 GOOGLE_CALENDAR_ID/KEY 없이 통과한다', () => {
      expect(() => validate(createValidConfig())).not.toThrow();
    });

    it('CALENDAR_PROVIDER=google 인데 GOOGLE_CALENDAR_ID가 없으면 실패한다', () => {
      expect(() => {
        validate({
          ...createValidConfig(),
          CALENDAR_PROVIDER: 'google',
          GOOGLE_CALENDAR_KEY_FILE_PATH: '/app/gcp-key.json',
        });
      }).toThrow('GOOGLE_CALENDAR_ID');
    });

    it('CALENDAR_PROVIDER=google 인데 GOOGLE_CALENDAR_KEY_FILE_PATH가 없으면 실패한다', () => {
      expect(() => {
        validate({
          ...createValidConfig(),
          CALENDAR_PROVIDER: 'google',
          GOOGLE_CALENDAR_ID: 'test@group.calendar.google.com',
        });
      }).toThrow('GOOGLE_CALENDAR_KEY_FILE_PATH');
    });

    it('CALENDAR_PROVIDER=google 이고 ID/KEY가 모두 있으면 통과한다', () => {
      expect(() =>
        validate({
          ...createValidConfig(),
          CALENDAR_PROVIDER: 'google',
          GOOGLE_CALENDAR_ID: 'test@group.calendar.google.com',
          GOOGLE_CALENDAR_KEY_FILE_PATH: '/app/gcp-key.json',
        }),
      ).not.toThrow();
    });
  });

  describe('STORAGE_PROVIDER 화이트리스트 검증', () => {
    it('STORAGE_PROVIDER 미설정이면 기본값 console 로 통과한다', () => {
      const result = validate(createValidConfig());

      expect(result.STORAGE_PROVIDER).toBe('console');
    });

    it('STORAGE_PROVIDER=gcs 는 통과한다', () => {
      expect(() => validate({ ...createValidConfig(), STORAGE_PROVIDER: 'gcs' })).not.toThrow();
    });

    it('알 수 없는 STORAGE_PROVIDER 값은 앱 시작 전에 실패한다', () => {
      expect(() => {
        validate({ ...createValidConfig(), STORAGE_PROVIDER: 'GCS' });
      }).toThrow('STORAGE_PROVIDER');
    });

    it('대문자/오타 STORAGE_PROVIDER 도 거부한다', () => {
      expect(() => {
        validate({ ...createValidConfig(), STORAGE_PROVIDER: 'aws-s3' });
      }).toThrow('STORAGE_PROVIDER');
    });
  });
});
