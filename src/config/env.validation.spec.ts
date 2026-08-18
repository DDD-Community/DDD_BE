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

  describe('DB_SYNCHRONIZE 스위치', () => {
    // 이 값은 프로덕션 DB 에 자동 DDL 을 돌릴지를 결정한다.
    // 기본값이 바뀌면 기존 배포의 스키마 반영 방식이 조용히 달라지므로 회귀 테스트로 고정한다.
    it('미설정이면 기존 동작인 true 가 유지된다', () => {
      const result = validate(createValidConfig());

      expect(result.DB_SYNCHRONIZE).toBe('true');
    });

    it('false 를 명시하면 그대로 유지된다', () => {
      const result = validate({ ...createValidConfig(), DB_SYNCHRONIZE: 'false' });

      expect(result.DB_SYNCHRONIZE).toBe('false');
    });

    it('빈 문자열이어도 앱 부팅을 막지 않는다', () => {
      expect(() => validate({ ...createValidConfig(), DB_SYNCHRONIZE: '' })).not.toThrow();
    });

    it('true/false 가 아닌 값이면 앱 시작 전에 실패한다', () => {
      expect(() => validate({ ...createValidConfig(), DB_SYNCHRONIZE: 'yes' })).toThrow();
    });
  });

  describe('APP_VERSION', () => {
    // 배포 워크플로가 "요청한 커밋 == 실행 중인 커밋" 을 이 값으로 판정한다.
    it('미설정이면 unknown 이 되어 배포 검증이 불일치로 떨어진다', () => {
      const result = validate(createValidConfig());

      expect(result.APP_VERSION).toBe('unknown');
    });

    it('이미지가 각인한 커밋 SHA 를 그대로 통과시킨다', () => {
      const sha = 'ab0974367cfcc5295df479bf59336a14a497a4b0';

      const result = validate({ ...createValidConfig(), APP_VERSION: sha });

      expect(result.APP_VERSION).toBe(sha);
    });
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

  describe('EMAIL_PROVIDER 조건부 검증', () => {
    // gmail 로 바꿔만 두고 자격증명을 안 넣으면 앱은 부팅되지만 메일은 한 통도 안 나간다.
    // 그 상태를 발송 시점이 아니라 부팅 시점에 잡는다.
    it('EMAIL_PROVIDER 미설정이면 기본값 console 로 통과한다', () => {
      const config = createValidConfig();
      delete config.EMAIL_PROVIDER;

      const result = validate(config);

      expect(result.EMAIL_PROVIDER).toBe('console');
    });

    // 시크릿이 비어 EMAIL_PROVIDER= 만 들어가는 경우다. 조용히 console 로 흘리지 않는다.
    it('EMAIL_PROVIDER 가 빈 문자열이면 앱 시작 전에 실패한다', () => {
      expect(() => validate({ ...createValidConfig(), EMAIL_PROVIDER: '' })).toThrow(
        'EMAIL_PROVIDER',
      );
    });

    it('EMAIL_PROVIDER=console 이면 GMAIL_* 없이 통과한다', () => {
      expect(() => validate(createValidConfig())).not.toThrow();
    });

    it('EMAIL_PROVIDER=gmail 인데 GMAIL_USER가 없으면 실패한다', () => {
      expect(() => {
        validate({
          ...createValidConfig(),
          EMAIL_PROVIDER: 'gmail',
          GMAIL_APP_PASSWORD: 'app-password',
          EMAIL_FROM: 'noreply@dddstudy.kr',
        });
      }).toThrow('GMAIL_USER');
    });

    it('EMAIL_PROVIDER=gmail 인데 GMAIL_APP_PASSWORD가 없으면 실패한다', () => {
      expect(() => {
        validate({
          ...createValidConfig(),
          EMAIL_PROVIDER: 'gmail',
          GMAIL_USER: 'noreply@dddstudy.kr',
          EMAIL_FROM: 'noreply@dddstudy.kr',
        });
      }).toThrow('GMAIL_APP_PASSWORD');
    });

    it('EMAIL_PROVIDER=gmail 인데 EMAIL_FROM이 없으면 실패한다', () => {
      expect(() => {
        validate({
          ...createValidConfig(),
          EMAIL_PROVIDER: 'gmail',
          GMAIL_USER: 'noreply@dddstudy.kr',
          GMAIL_APP_PASSWORD: 'app-password',
        });
      }).toThrow('EMAIL_FROM');
    });

    it('EMAIL_PROVIDER=gmail 이고 자격증명이 모두 있으면 통과한다', () => {
      expect(() =>
        validate({
          ...createValidConfig(),
          EMAIL_PROVIDER: 'gmail',
          GMAIL_USER: 'noreply@dddstudy.kr',
          GMAIL_APP_PASSWORD: 'app-password',
          EMAIL_FROM: 'noreply@dddstudy.kr',
        }),
      ).not.toThrow();
    });

    // resend 는 제거된 provider 다. .env.example 에 남아 있던 값이 조용히 통과하면
    // 다시 console 과 같은 무발송 상태가 된다.
    it('제거된 provider(resend)는 앱 시작 전에 실패한다', () => {
      expect(() => {
        validate({ ...createValidConfig(), EMAIL_PROVIDER: 'resend' });
      }).toThrow('EMAIL_PROVIDER');
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
