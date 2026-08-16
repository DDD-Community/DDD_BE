import { Project } from '../../domain/project.entity';
import { ProjectPlatform } from '../../domain/project-platform';
import {
  AdminProjectListResponseDto,
  ProjectDetailResponseDto,
  ProjectListResponseDto,
} from './project.response.dto';

const projectFixture = {
  id: 1,
  cohortId: 1,
  cohort: { id: 1, name: '13기' },
  platforms: [ProjectPlatform.IOS],
  name: 'FESTIBEE (페스티비)',
  description: '언제 열리는지, 누가 나오는지 한 번에 확인할 수 있는 곳',
  thumbnailUrl: 'https://example.com/thumbnail.png',
  pdfUrl: 'https://example.com/project.pdf',
  members: [
    { id: 1, name: '최현희', part: 'PM' },
    { id: 2, name: '문규성', part: 'BE' },
  ],
  createdAt: new Date('2026-04-01'),
  updatedAt: new Date('2026-04-01'),
} as unknown as Project;

const expectedMembers = [
  { name: '최현희', part: 'PM' },
  { name: '문규성', part: 'BE' },
];

describe('ProjectListResponseDto (공개 목록)', () => {
  // 인증 없이 접근 가능한 응답이므로 참여자·PDF 가 새어나가면 안 된다.
  it('참여자를 포함하지 않는다', () => {
    // Given & When
    const dto = ProjectListResponseDto.from(projectFixture);

    // Then
    expect(dto).not.toHaveProperty('members');
  });

  it('PDF URL 을 포함하지 않는다', () => {
    // Given & When
    const dto = ProjectListResponseDto.from(projectFixture);

    // Then
    expect(dto).not.toHaveProperty('pdfUrl');
  });

  it('목록에 필요한 필드는 담는다', () => {
    // Given & When
    const dto = ProjectListResponseDto.from(projectFixture);

    // Then
    expect(dto).toEqual({
      id: 1,
      cohortId: 1,
      cohortName: '13기',
      platforms: [ProjectPlatform.IOS],
      name: 'FESTIBEE (페스티비)',
      description: '언제 열리는지, 누가 나오는지 한 번에 확인할 수 있는 곳',
      thumbnailUrl: 'https://example.com/thumbnail.png',
      createdAt: new Date('2026-04-01'),
    });
  });
});

describe('AdminProjectListResponseDto (어드민 목록)', () => {
  // 어드민 수정 드로워가 목록 응답만으로 폼을 채우므로,
  // 여기서 members 가 빠지면 저장했던 참여자가 화면에서 사라진다.
  it('참여자 목록을 포함한다', () => {
    // Given & When
    const dto = AdminProjectListResponseDto.from(projectFixture);

    // Then
    expect(dto.members).toEqual(expectedMembers);
  });

  it('PDF URL 을 포함한다', () => {
    // Given & When
    const dto = AdminProjectListResponseDto.from(projectFixture);

    // Then
    expect(dto.pdfUrl).toBe('https://example.com/project.pdf');
  });

  it('공개 목록의 필드를 그대로 상속한다', () => {
    // Given & When
    const dto = AdminProjectListResponseDto.from(projectFixture);

    // Then
    expect(dto.cohortName).toBe('13기');
    expect(dto.thumbnailUrl).toBe('https://example.com/thumbnail.png');
  });

  it('참여자 관계가 로드되지 않았으면 빈 배열을 반환한다', () => {
    // Given
    const withoutMembers = { ...projectFixture, members: undefined } as unknown as Project;

    // When
    const dto = AdminProjectListResponseDto.from(withoutMembers);

    // Then
    expect(dto.members).toEqual([]);
  });

  it('PDF 가 없으면 null 을 반환한다', () => {
    // Given
    const withoutPdf = { ...projectFixture, pdfUrl: undefined } as unknown as Project;

    // When
    const dto = AdminProjectListResponseDto.from(withoutPdf);

    // Then
    expect(dto.pdfUrl).toBeNull();
  });
});

describe('ProjectDetailResponseDto (상세)', () => {
  it('참여자 목록과 수정 일시를 포함한다', () => {
    // Given & When
    const dto = ProjectDetailResponseDto.from(projectFixture);

    // Then
    expect(dto.members).toEqual(expectedMembers);
    expect(dto.updatedAt).toEqual(new Date('2026-04-01'));
  });

  it('참여자 관계가 로드되지 않았으면 빈 배열을 반환한다', () => {
    // Given
    const withoutMembers = { ...projectFixture, members: undefined } as unknown as Project;

    // When
    const dto = ProjectDetailResponseDto.from(withoutMembers);

    // Then
    expect(dto.members).toEqual([]);
  });
});
