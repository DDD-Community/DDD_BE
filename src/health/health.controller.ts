import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

import { VersionResponseDto } from './dto/version.response.dto';

@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
    private readonly config: ConfigService,
  ) {}

  @ApiOperation({ summary: 'Health check', operationId: 'health_getHealth' })
  @Get()
  @HealthCheck()
  async check() {
    const checks = [() => this.database.pingCheck('database')];
    return this.health.check(checks);
  }

  /**
   * 실행 중인 컨테이너의 빌드 커밋을 그대로 노출한다.
   * 배포 워크플로가 "요청한 커밋 == 실제 실행 중인 커밋" 을 검증하는 데 사용하며,
   * DB 에 의존하지 않으므로 DB 장애 중에도 응답한다.
   */
  @ApiOperation({ summary: '실행 중인 빌드 버전', operationId: 'health_getVersion' })
  @ApiOkResponse({ type: VersionResponseDto })
  @Get('version')
  getVersion(): VersionResponseDto {
    const version = this.config.get<string>('APP_VERSION') ?? 'unknown';

    return { version };
  }
}
