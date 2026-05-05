import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

import { AppException } from '../exception/app.exception';

const HEADER_NAME = 'x-bootstrap-token';

@Injectable()
export class BootstrapTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.configService.get<string>('ADMIN_BOOTSTRAP_TOKEN');
    if (!expected) {
      throw new AppException('BOOTSTRAP_TOKEN_NOT_CONFIGURED', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers[HEADER_NAME];

    if (typeof provided !== 'string' || !this.matches(expected, provided)) {
      throw new AppException('BOOTSTRAP_TOKEN_INVALID', HttpStatus.UNAUTHORIZED);
    }

    return true;
  }

  private matches(expected: string, provided: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);
    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, providedBuffer);
  }
}
