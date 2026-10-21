import { getRepositoryToken } from '@nestjs/typeorm';

import { InterviewSlotInterviewer } from './domain/interview-slot-interviewer.entity';
import { InterviewModule } from './interview.module';

type DynamicModuleLike = { providers?: Array<{ provide?: unknown }> };

describe('InterviewModule', () => {
  it('면접관 엔티티를 TypeOrmModule.forFeature 로 등록한다', () => {
    const imports = (Reflect.getMetadata('imports', InterviewModule) ?? []) as unknown[];
    const token = getRepositoryToken(InterviewSlotInterviewer);
    const registered = imports.some((item) =>
      ((item as DynamicModuleLike).providers ?? []).some((provider) => provider.provide === token),
    );
    expect(registered).toBe(true);
  });
});
