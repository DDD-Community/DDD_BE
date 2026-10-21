import { JwtService } from '@nestjs/jwt';

import { InterviewJoinTokenService } from './interview-join-token.service';

describe('InterviewJoinTokenService', () => {
  const jwt = new JwtService({ secret: 'test-secret' });
  const config = {
    get: (key: string) => (key === 'INTERVIEW_JOIN_BASE_URL' ? '' : undefined),
    getOrThrow: () => 'https://api.example.com/auth/google/callback',
  };
  const service = new InterviewJoinTokenService(jwt, config as never);

  it('예약 ID를 담아 발급하고 검증하며 기본 입장 URL을 만든다', () => {
    // When
    const token = service.issue({ reservationId: 55 });
    const url = service.createUrl({ reservationId: 55 });

    // Then
    expect(service.verify({ token })).toMatchObject({
      purpose: 'interview_join',
      reservationId: 55,
    });
    expect(url).toMatch(/^https:\/\/api\.example\.com\/api\/v1\/interview-bookings\/join\?token=/);
    expect(jwt.decode(token)).not.toHaveProperty('slotEndAt');
  });

  it('만료를 슬롯 시각이 아니라 발급 시점부터 180일로 둔다', () => {
    // 면접을 한참 뒤로 미뤄도 이미 보낸 메일 링크가 살아 있어야 한다.
    // When
    const token = service.issue({ reservationId: 55 });

    // Then
    const { iat, exp } = jwt.decode<{ iat: number; exp: number }>(token);
    expect(exp - iat).toBe(180 * 24 * 60 * 60);
  });

  it('다른 목적, 손상된 값, 만료된 토큰을 거부한다', () => {
    // Given
    const otherPurpose = jwt.sign({ purpose: 'interview_booking', reservationId: 55 });
    const expired = jwt.sign({ purpose: 'interview_join', reservationId: 55 }, { expiresIn: -1 });

    // When / Then
    expect(service.verify({ token: otherPurpose })).toBeNull();
    expect(service.verify({ token: 'garbage' })).toBeNull();
    expect(service.verify({ token: expired })).toBeNull();
  });

  it('설정한 URL을 사용한다', () => {
    const customConfig = {
      get: () => 'https://join.example.com/interview',
      getOrThrow: jest.fn(),
    };
    const customService = new InterviewJoinTokenService(jwt, customConfig as never);
    const url = customService.createUrl({ reservationId: 55 });
    expect(url).toMatch(/^https:\/\/join\.example\.com\/interview\?token=/);
    expect(customConfig.getOrThrow).not.toHaveBeenCalled();
  });

  it('설정한 URL에 쿼리나 fragment가 있어도 token을 쿼리 매개변수로 넣는다', () => {
    // Given
    const customService = new InterviewJoinTokenService(jwt, {
      get: () => 'https://join.example.com/interview?src=mail#top',
      getOrThrow: jest.fn(),
    } as never);

    // When
    const url = new URL(customService.createUrl({ reservationId: 55 }));

    // Then
    expect(url.searchParams.get('src')).toBe('mail');
    expect(customService.verify({ token: url.searchParams.get('token') ?? '' })).toMatchObject({
      reservationId: 55,
    });
    expect(url.hash).toBe('#top');
  });
});
