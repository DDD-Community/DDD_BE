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

  @ValidateIf((env: EnvironmentVariables) => env.EMAIL_PROVIDER === 'resend')
  @IsString({ message: 'EMAIL_PROVIDER=resend 일 때 RESEND_API_KEY는 필수입니다.' })
  @IsNotEmpty({ message: 'EMAIL_PROVIDER=resend 일 때 RESEND_API_KEY는 필수입니다.' })
  RESEND_API_KEY?: string;

  @ValidateIf((env: EnvironmentVariables) => env.EMAIL_PROVIDER === 'resend')
  @IsString({ message: 'EMAIL_PROVIDER=resend 일 때 EMAIL_FROM은 필수입니다.' })
  @IsNotEmpty({ message: 'EMAIL_PROVIDER=resend 일 때 EMAIL_FROM은 필수입니다.' })
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

  @ValidateIf((env: EnvironmentVariables) => env.STORAGE_PROVIDER === 'gcs')
  @IsString({ message: 'STORAGE_PROVIDER=gcs 일 때 GCS_BUCKET_NAME은 필수입니다.' })
  @IsNotEmpty({ message: 'STORAGE_PROVIDER=gcs 일 때 GCS_BUCKET_NAME은 필수입니다.' })
  GCS_BUCKET_NAME?: string;

  @ValidateIf((env: EnvironmentVariables) => env.STORAGE_PROVIDER === 'gcs')
  @IsString({ message: 'STORAGE_PROVIDER=gcs 일 때 GCS_PROJECT_ID는 필수입니다.' })
  @IsNotEmpty({ message: 'STORAGE_PROVIDER=gcs 일 때 GCS_PROJECT_ID는 필수입니다.' })
  GCS_PROJECT_ID?: string;

  @ValidateIf((env: EnvironmentVariables) => env.STORAGE_PROVIDER === 'gcs')
  @IsString({ message: 'STORAGE_PROVIDER=gcs 일 때 GCS_KEY_FILE_PATH는 필수입니다.' })
  @IsNotEmpty({ message: 'STORAGE_PROVIDER=gcs 일 때 GCS_KEY_FILE_PATH는 필수입니다.' })
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

  @ValidateIf((env: EnvironmentVariables) => env.DISCORD_PROVIDER === 'discord')
  @IsString({ message: 'DISCORD_PROVIDER=discord 일 때 DISCORD_CLIENT_ID는 필수입니다.' })
  @IsNotEmpty({ message: 'DISCORD_PROVIDER=discord 일 때 DISCORD_CLIENT_ID는 필수입니다.' })
  DISCORD_CLIENT_ID?: string;

  @ValidateIf((env: EnvironmentVariables) => env.DISCORD_PROVIDER === 'discord')
  @IsString({ message: 'DISCORD_PROVIDER=discord 일 때 DISCORD_CLIENT_SECRET은 필수입니다.' })
  @IsNotEmpty({ message: 'DISCORD_PROVIDER=discord 일 때 DISCORD_CLIENT_SECRET은 필수입니다.' })
  DISCORD_CLIENT_SECRET?: string;

  @ValidateIf((env: EnvironmentVariables) => env.DISCORD_PROVIDER === 'discord')
  @IsString({ message: 'DISCORD_PROVIDER=discord 일 때 DISCORD_CALLBACK_URL은 필수입니다.' })
  @IsNotEmpty({ message: 'DISCORD_PROVIDER=discord 일 때 DISCORD_CALLBACK_URL은 필수입니다.' })
  DISCORD_CALLBACK_URL?: string;

  @ValidateIf((env: EnvironmentVariables) => env.DISCORD_PROVIDER === 'discord')
  @IsString({ message: 'DISCORD_PROVIDER=discord 일 때 DISCORD_BOT_TOKEN은 필수입니다.' })
  @IsNotEmpty({ message: 'DISCORD_PROVIDER=discord 일 때 DISCORD_BOT_TOKEN은 필수입니다.' })
  DISCORD_BOT_TOKEN?: string;

  @ValidateIf((env: EnvironmentVariables) => env.DISCORD_PROVIDER === 'discord')
  @IsString({ message: 'DISCORD_PROVIDER=discord 일 때 DISCORD_GUILD_ID는 필수입니다.' })
  @IsNotEmpty({ message: 'DISCORD_PROVIDER=discord 일 때 DISCORD_GUILD_ID는 필수입니다.' })
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
