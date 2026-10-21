import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { JwtService } from '@nestjs/jwt';

type CalendarConnectState = {
  purpose: 'google_calendar_connect';
  userId: number;
  nonceHash: string;
};

export const createCalendarConnectState = ({
  jwtService,
  userId,
}: {
  jwtService: JwtService;
  userId: number;
}) => {
  const nonce = randomBytes(32).toString('base64url');
  const nonceHash = createHash('sha256').update(nonce).digest('hex');
  const state = jwtService.sign(
    { purpose: 'google_calendar_connect', userId, nonceHash },
    { expiresIn: '10m' },
  );
  return { nonce, state };
};

export const verifyCalendarConnectState = ({
  jwtService,
  state,
  nonce,
  userId,
}: {
  jwtService: JwtService;
  state?: string;
  nonce?: string;
  userId: number;
}): boolean => {
  if (!state || !nonce) {
    return false;
  }
  try {
    const payload = jwtService.verify<CalendarConnectState>(state);
    if (payload.purpose !== 'google_calendar_connect' || payload.userId !== userId) {
      return false;
    }
    const nonceHash = createHash('sha256').update(nonce).digest('hex');
    if (typeof payload.nonceHash !== 'string' || payload.nonceHash.length !== nonceHash.length) {
      return false;
    }
    return timingSafeEqual(Buffer.from(nonceHash), Buffer.from(payload.nonceHash));
  } catch {
    return false;
  }
};
