import { applyDecorators } from '@nestjs/common';
import type { ApiResponseOptions } from '@nestjs/swagger';
import { ApiCookieAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

interface ApiDocOptions {
  summary: string;
  description?: string;
  auth?: boolean;
  responses?: ApiResponseOptions[];
}

export const ApiDoc = ({ summary, description, auth = false, responses = [] }: ApiDocOptions) =>
  applyDecorators(
    ApiOperation({ summary, description }),
    ...(auth ? [ApiCookieAuth('access_token')] : []),
    ...responses.map((r) => ApiResponse(r)),
  );
