import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

import { AppException } from '../../common/exception/app.exception';
import {
  InterviewBookingTokenPayload,
  InterviewBookingTokenService,
} from '../application/interview-booking-token.service';

type BookingRequest = Request & { interviewBooking?: InterviewBookingTokenPayload };

@Injectable()
export class InterviewBookingGuard implements CanActivate {
  constructor(private readonly tokenService: InterviewBookingTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<BookingRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new AppException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    }
    request.interviewBooking = this.tokenService.verify({
      token: authorization.slice('Bearer '.length),
    });
    return true;
  }
}

export const BookingToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext): InterviewBookingTokenPayload => {
    const request = context.switchToHttp().getRequest<BookingRequest>();
    if (!request.interviewBooking) {
      throw new AppException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    }
    return request.interviewBooking;
  },
);
