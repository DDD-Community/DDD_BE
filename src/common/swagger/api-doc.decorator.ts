import { applyDecorators } from '@nestjs/common';
import type { ApiResponseOptions } from '@nestjs/swagger';
import { ApiCookieAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

interface ApiDocOptions {
  summary: string;
  description?: string;
  operationId?: string;
  auth?: boolean;
  responses?: ApiResponseOptions[];
}

export const ApiDoc = ({ summary, description, operationId, auth = false, responses = [] }: ApiDocOptions) =>
  applyDecorators(
    ApiOperation({ summary, description, operationId }),
    ...(auth ? [ApiCookieAuth('access_token')] : []),
    ...responses.map((r) => ApiResponse(r)),
  );
