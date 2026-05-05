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

    it('STORAGE_PROVIDER=gcs + 필수 GCS 키가 모두 있으면 통과한다', () => {
      expect(() =>
        validate({
          ...createValidConfig(),
          STORAGE_PROVIDER: 'gcs',
          GCS_BUCKET_NAME: 'ddd-bucket',
          GCS_PROJECT_ID: 'ddd-project',
          GCS_KEY_FILE_PATH: '/app/gcp-key.json',
        }),
      ).not.toThrow();
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

  describe('EMAIL_PROVIDER 조건부 검증', () => {
    it('EMAIL_PROVIDER=console(기본)이면 RESEND_API_KEY/EMAIL_FROM 없이 통과한다', () => {
      expect(() => validate(createValidConfig())).not.toThrow();
    });

    it('EMAIL_PROVIDER=resend 인데 RESEND_API_KEY가 없으면 실패한다', () => {
      expect(() => {
        validate({
          ...createValidConfig(),
          EMAIL_PROVIDER: 'resend',
          EMAIL_FROM: 'noreply@dddsite.co.kr',
        });
      }).toThrow('RESEND_API_KEY');
    });

    it('EMAIL_PROVIDER=resend 인데 EMAIL_FROM이 없으면 실패한다', () => {
      expect(() => {
        validate({
          ...createValidConfig(),
          EMAIL_PROVIDER: 'resend',
          RESEND_API_KEY: 're_test_key',
        });
      }).toThrow('EMAIL_FROM');
    });

    it('EMAIL_PROVIDER=resend 이고 KEY/FROM 이 모두 있으면 통과한다', () => {
      expect(() =>
        validate({
          ...createValidConfig(),
          EMAIL_PROVIDER: 'resend',
          RESEND_API_KEY: 're_test_key',
          EMAIL_FROM: 'noreply@dddsite.co.kr',
        }),
      ).not.toThrow();
    });
  });

  describe('STORAGE_PROVIDER 조건부 검증', () => {
    it('STORAGE_PROVIDER=gcs 인데 GCS_BUCKET_NAME이 없으면 실패한다', () => {
      expect(() => {
        validate({
          ...createValidConfig(),
          STORAGE_PROVIDER: 'gcs',
          GCS_PROJECT_ID: 'ddd-project',
          GCS_KEY_FILE_PATH: '/app/gcp-key.json',
        });
      }).toThrow('GCS_BUCKET_NAME');
    });

    it('STORAGE_PROVIDER=gcs 인데 GCS_PROJECT_ID가 없으면 실패한다', () => {
      expect(() => {
        validate({
          ...createValidConfig(),
          STORAGE_PROVIDER: 'gcs',
          GCS_BUCKET_NAME: 'ddd-bucket',
          GCS_KEY_FILE_PATH: '/app/gcp-key.json',
        });
      }).toThrow('GCS_PROJECT_ID');
    });

    it('STORAGE_PROVIDER=gcs 인데 GCS_KEY_FILE_PATH가 없으면 실패한다', () => {
      expect(() => {
        validate({
          ...createValidConfig(),
          STORAGE_PROVIDER: 'gcs',
          GCS_BUCKET_NAME: 'ddd-bucket',
          GCS_PROJECT_ID: 'ddd-project',
        });
      }).toThrow('GCS_KEY_FILE_PATH');
    });
  });

  describe('DISCORD_PROVIDER 조건부 검증', () => {
    const buildDiscordConfig = (): Record<string, unknown> => ({
      ...createValidConfig(),
      DISCORD_PROVIDER: 'discord',
      DISCORD_CLIENT_ID: 'discord-client',
      DISCORD_CLIENT_SECRET: 'discord-secret',
      DISCORD_CALLBACK_URL: 'https://api.dddsite.co.kr/discord/callback',
      DISCORD_BOT_TOKEN: 'discord-bot-token',
      DISCORD_GUILD_ID: 'discord-guild-id',
    });

    it('DISCORD_PROVIDER 미설정(기본 console)이면 DISCORD_* 없이 통과한다', () => {
      expect(() => validate(createValidConfig())).not.toThrow();
    });

    it('DISCORD_PROVIDER=discord 이고 핵심 5개가 모두 있으면 통과한다', () => {
      expect(() => validate(buildDiscordConfig())).not.toThrow();
    });

    it('DISCORD_PROVIDER=discord 인데 DISCORD_CLIENT_ID가 없으면 실패한다', () => {
      const config = buildDiscordConfig();
      delete config.DISCORD_CLIENT_ID;

      expect(() => validate(config)).toThrow('DISCORD_CLIENT_ID');
    });

    it('DISCORD_PROVIDER=discord 인데 DISCORD_CLIENT_SECRET이 없으면 실패한다', () => {
      const config = buildDiscordConfig();
      delete config.DISCORD_CLIENT_SECRET;

      expect(() => validate(config)).toThrow('DISCORD_CLIENT_SECRET');
    });

    it('DISCORD_PROVIDER=discord 인데 DISCORD_CALLBACK_URL이 없으면 실패한다', () => {
      const config = buildDiscordConfig();
      delete config.DISCORD_CALLBACK_URL;

      expect(() => validate(config)).toThrow('DISCORD_CALLBACK_URL');
    });

    it('DISCORD_PROVIDER=discord 인데 DISCORD_BOT_TOKEN이 없으면 실패한다', () => {
      const config = buildDiscordConfig();
      delete config.DISCORD_BOT_TOKEN;

      expect(() => validate(config)).toThrow('DISCORD_BOT_TOKEN');
    });

    it('DISCORD_PROVIDER=discord 인데 DISCORD_GUILD_ID가 없으면 실패한다', () => {
      const config = buildDiscordConfig();
      delete config.DISCORD_GUILD_ID;

      expect(() => validate(config)).toThrow('DISCORD_GUILD_ID');
    });
  });
});
