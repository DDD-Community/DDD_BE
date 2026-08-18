import { ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import type { ThrottlerLimitDetail } from '@nestjs/throttler';
import { ThrottlerGuard } from '@nestjs/throttler';

import { AppException } from '../exception/app.exception';

@Injectable()
export class KoreanThrottlerGuard extends ThrottlerGuard {
  protected throwThrottlingException(
    _context: ExecutionContext,
    _throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    return Promise.reject(new AppException('TOO_MANY_REQUESTS', HttpStatus.TOO_MANY_REQUESTS));
  }
}
