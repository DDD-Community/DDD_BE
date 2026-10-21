import { getRepositoryToken } from '@nestjs/typeorm';

import { GoogleCalendarConnection } from './domain/google-calendar-connection.entity';
import { GoogleCalendarModule } from './google-calendar.module';

type DynamicModuleLike = { providers?: Array<{ provide?: unknown }> };

describe('GoogleCalendarModule', () => {
  // 앱은 autoLoadEntities 를 쓴다. forFeature 등록이 빠지면 단위·통합 테스트는 통과해도
  // 운영에서 저장 시 EntityMetadataNotFoundError 가 난다(2026-10-21 실제 발생).
  it('연결 엔티티를 TypeOrmModule.forFeature 로 등록한다', () => {
    const imports = (Reflect.getMetadata('imports', GoogleCalendarModule) ?? []) as unknown[];
    const repositoryToken = getRepositoryToken(GoogleCalendarConnection);

    const registered = imports.some((item) =>
      ((item as DynamicModuleLike).providers ?? []).some(
        (provider) => provider.provide === repositoryToken,
      ),
    );

    expect(registered).toBe(true);
  });
});
