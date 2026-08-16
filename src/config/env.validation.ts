import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
  validateSync,
} from 'class-validator';

export const STORAGE_PROVIDERS = ['console', 'gcs'] as const;
export type StorageProvider = (typeof STORAGE_PROVIDERS)[number];

class EnvironmentVariables {
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  DB_HOST: string;

  @IsNumber()
  @Min(1)
  @Max(65535)
  DB_PORT: number;

  @IsString()
  DB_USERNAME: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  DB_NAME: string;

  @IsString()
  @IsOptional()
  NODE_ENV: string = 'development';

  // 이미지 빌드 시 Dockerfile 이 주입하는 커밋 SHA. 배포 검증에 사용한다.
  @IsString()
  @IsOptional()
  APP_VERSION: string = 'unknown';

  // 운영에서 자동 DDL(synchronize) 을 끄기 위한 스위치.
  // 마이그레이션 체계가 갖춰지기 전까지 기본값은 기존 동작(true) 을 유지한다.
  // 환경변수는 항상 문자열로 들어오므로 boolean 대신 명시적 문자열로 검증한다.
  // (boolean 으로 선언하면 enableImplicitConversion 이 'false' 를 true 로 뒤집는다)
  // 빈 문자열이 들어오면 @IsIn 이 실패해 앱이 부팅조차 못 하므로 미설정과 동일하게 취급한다.
  @ValidateIf((env: EnvironmentVariables) => env.DB_SYNCHRONIZE !== '')
  @IsIn(['true', 'false'])
  @IsOptional()
  DB_SYNCHRONIZE: string = 'true';

  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '1d';

  @IsString()
  @IsOptional()
  ADMIN_BOOTSTRAP_TOKEN?: string;

  @IsString()
  @IsOptional()
  ADMIN_BOOTSTRAP_TOKEN_EXPIRES_AT?: string;

  @IsString()
  GOOGLE_CLIENT_ID: string;

  @IsString()
  GOOGLE_CLIENT_SECRET: string;

  @IsString()
  GOOGLE_CALLBACK_URL: string;

  @IsString()
  CLIENT_REDIRECT_URL: string;

  @IsString()
  @Matches(/^[0-9a-fA-F]{64}$/, {
    message: 'ENCRYPTION_KEY must be a 64-character hex string.',
  })
  ENCRYPTION_KEY: string;

  @IsString()
  @IsOptional()
  EMAIL_PROVIDER: string = 'console';

  @IsString()
  @IsOptional()
  RESEND_API_KEY?: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM?: string;

  @IsString()
  @IsOptional()
  OPS_ALERT_EMAIL?: string;

  @IsString()
  @IsOptional()
  INTERVIEW_BOOKING_URL?: string;

  @IsString()
  @IsOptional()
  DISCORD_INVITE_URL?: string;

  @IsIn(STORAGE_PROVIDERS, {
    message: `STORAGE_PROVIDER 는 ${STORAGE_PROVIDERS.join(' | ')} 중 하나여야 합니다.`,
  })
  @IsOptional()
  STORAGE_PROVIDER?: StorageProvider = 'console';

  @IsString()
  @IsOptional()
  GCS_BUCKET_NAME?: string;

  @IsString()
  @IsOptional()
  GCS_PROJECT_ID?: string;

  @IsString()
  @IsOptional()
  GCS_KEY_FILE_PATH?: string;

  @IsString()
  @IsOptional()
  CALENDAR_PROVIDER?: string = 'console';

  @ValidateIf((env: EnvironmentVariables) => env.CALENDAR_PROVIDER === 'google')
  @IsString({
    message: 'CALENDAR_PROVIDER=google 일 때 GOOGLE_CALENDAR_ID는 필수입니다.',
  })
  @IsNotEmpty({
    message: 'CALENDAR_PROVIDER=google 일 때 GOOGLE_CALENDAR_ID는 필수입니다.',
  })
  GOOGLE_CALENDAR_ID?: string;

  @ValidateIf((env: EnvironmentVariables) => env.CALENDAR_PROVIDER === 'google')
  @IsString({
    message: 'CALENDAR_PROVIDER=google 일 때 GOOGLE_CALENDAR_KEY_FILE_PATH는 필수입니다.',
  })
  @IsNotEmpty({
    message: 'CALENDAR_PROVIDER=google 일 때 GOOGLE_CALENDAR_KEY_FILE_PATH는 필수입니다.',
  })
  GOOGLE_CALENDAR_KEY_FILE_PATH?: string;

  @IsString()
  @IsOptional()
  DISCORD_PROVIDER?: string = 'console';

  @IsString()
  @IsOptional()
  DISCORD_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  DISCORD_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  DISCORD_CALLBACK_URL?: string;

  @IsString()
  @IsOptional()
  DISCORD_BOT_TOKEN?: string;

  @IsString()
  @IsOptional()
  DISCORD_GUILD_ID?: string;

  @IsString()
  @IsOptional()
  DISCORD_ROLE_ID_PM?: string;

  @IsString()
  @IsOptional()
  DISCORD_ROLE_ID_PD?: string;

  @IsString()
  @IsOptional()
  DISCORD_ROLE_ID_BE?: string;

  @IsString()
  @IsOptional()
  DISCORD_ROLE_ID_FE?: string;

  @IsString()
  @IsOptional()
  DISCORD_ROLE_ID_IOS?: string;

  @IsString()
  @IsOptional()
  DISCORD_ROLE_ID_AOS?: string;
}

export const validate = (config: Record<string, unknown>) => {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));
    throw new Error(messages.join(', '));
  }

  return validated;
};
