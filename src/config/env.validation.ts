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

export const EMAIL_PROVIDERS = ['console', 'gmail'] as const;
export type EmailProvider = (typeof EMAIL_PROVIDERS)[number];

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

  // 운영에서 자동 DDL(synchronize) 을 끄기 위한 스위치. false 면 마이그레이션이 대신 돈다.
  // 운영은 deploy.yml 이 .env.production 에 false 를 써 넣는다.
  // 기본값이 true 인 것은 로컬 개발 편의를 위해서다(빈 DB 에 엔티티만으로 바로 붙는다).
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

  // 실제 발송 경로는 gmail 뿐이다. console 은 로그만 찍는 로컬 개발용이며,
  // 운영에서 console 로 남으면 메일이 안 나가고도 발송 로그가 SUCCESS 로 쌓인다.
  // (GmailEmailClient 가 운영 + console 조합을 발송 시점에 거부한다)
  @IsIn(EMAIL_PROVIDERS, {
    message: `EMAIL_PROVIDER 는 ${EMAIL_PROVIDERS.join(' | ')} 중 하나여야 합니다.`,
  })
  @IsOptional()
  EMAIL_PROVIDER: EmailProvider = 'console';

  @ValidateIf((env: EnvironmentVariables) => env.EMAIL_PROVIDER === 'gmail')
  @IsString({ message: 'EMAIL_PROVIDER=gmail 일 때 GMAIL_USER는 필수입니다.' })
  @IsNotEmpty({ message: 'EMAIL_PROVIDER=gmail 일 때 GMAIL_USER는 필수입니다.' })
  GMAIL_USER?: string;

  @ValidateIf((env: EnvironmentVariables) => env.EMAIL_PROVIDER === 'gmail')
  @IsString({ message: 'EMAIL_PROVIDER=gmail 일 때 GMAIL_APP_PASSWORD는 필수입니다.' })
  @IsNotEmpty({ message: 'EMAIL_PROVIDER=gmail 일 때 GMAIL_APP_PASSWORD는 필수입니다.' })
  GMAIL_APP_PASSWORD?: string;

  @ValidateIf((env: EnvironmentVariables) => env.EMAIL_PROVIDER === 'gmail')
  @IsString({ message: 'EMAIL_PROVIDER=gmail 일 때 EMAIL_FROM은 필수입니다.' })
  @IsNotEmpty({ message: 'EMAIL_PROVIDER=gmail 일 때 EMAIL_FROM은 필수입니다.' })
  EMAIL_FROM?: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM_NAME?: string;

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
