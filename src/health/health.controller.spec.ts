import { ConfigService } from '@nestjs/config';
import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  const createController = (configValue: string | undefined) => {
    const health = {} as HealthCheckService;
    const database = {} as TypeOrmHealthIndicator;
    const config = { get: jest.fn().mockReturnValue(configValue) } as unknown as ConfigService;

    return new HealthController(health, database, config);
  };

  describe('getVersion', () => {
    // 배포 워크플로가 "요청한 커밋 == 실행 중인 커밋" 을 이 값으로 판정한다.
    // 값이 비거나 형식이 달라지면 배포 검증이 통째로 무력화되므로 회귀 테스트로 고정한다.
    it('이미지에 각인된 커밋 SHA 를 그대로 반환한다', () => {
      // given
      const sha = 'ab0974367cfcc5295df479bf59336a14a497a4b0';
      const controller = createController(sha);

      // when
      const result = controller.getVersion();

      // then
      expect(result).toEqual({ version: sha });
    });

    it('APP_VERSION 이 없으면 unknown 을 반환한다', () => {
      // given
      const controller = createController(undefined);

      // when
      const result = controller.getVersion();

      // then
      expect(result).toEqual({ version: 'unknown' });
    });
  });
});
