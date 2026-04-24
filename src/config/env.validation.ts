import { plainToInstance } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Matches, Max, Min, validateSync } from 'class-validator';

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
  INTERVIEW_BOOKING_URL?: string;

  @IsString()
  @IsOptional()
  DISCORD_INVITE_URL?: string;

  @IsString()
  @IsOptional()
  STORAGE_PROVIDER?: string = 'console';

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

  @IsString()
  @IsOptional()
  GOOGLE_CALENDAR_ID?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CALENDAR_KEY_FILE_PATH?: string;
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
