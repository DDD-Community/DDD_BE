import { QueryFailedError } from 'typeorm';

export const PG_UNIQUE_VIOLATION = '23505';

export const isPostgresUniqueViolation = (error: unknown): boolean => {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const code = (error.driverError as { code?: string } | undefined)?.code;
  return code === PG_UNIQUE_VIOLATION;
};
