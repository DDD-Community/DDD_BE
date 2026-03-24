import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Cookie = createParamDecorator(
  (key: string, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<{ cookies: Record<string, string> }>();
    return request.cookies[key];
  },
);
