import type { ApplicationForm } from '../../../domain/application-form.entity';
import { AdminApplicationFormResponseDto } from './application.response.dto';

describe('AdminApplicationFormResponseDto review fixes', () => {
  it('파기된 지원서의 지원자 이메일은 null이다', () => {
    const form = {
      applicantName: null,
      applicantPhone: null,
      user: { email: 'homer@example.com' },
    } as unknown as ApplicationForm;

    expect(AdminApplicationFormResponseDto.from(form, []).applicantEmail).toBeNull();
  });
});
