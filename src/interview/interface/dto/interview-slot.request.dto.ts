import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateInterviewSlotRequestDto {
  @ApiProperty({ description: '기수 ID', example: 1 })
  @IsInt()
  cohortId: number;

  @ApiProperty({ description: '기수 파트 ID', example: 1 })
  @IsInt()
  cohortPartId: number;

  @ApiProperty({ description: '시작 시간', example: '2026-05-01T14:00:00+09:00' })
  @Type(() => Date)
  @IsDate()
  startAt: Date;

  @ApiProperty({ description: '종료 시간', example: '2026-05-01T14:30:00+09:00' })
  @Type(() => Date)
  @IsDate()
  endAt: Date;

  @ApiPropertyOptional({ description: '수용 인원 (기본 1)', default: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @ApiProperty({
    description:
      '장소. 예약 확정 시 지원자에게 메일과 캘린더 초대로 전달됩니다. 온라인 면접이면 미팅 링크를 넣으세요.',
    example: 'https://meet.google.com/abc-defg-hij',
  })
  // IsNotEmpty 는 공백 문자열을 통과시킨다. 앞뒤 공백을 먼저 털어내야
  // 스페이스 한 칸으로 필수 검증을 우회하는 길이 막힌다.
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  location: string;

  @ApiPropertyOptional({ description: '설명' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateInterviewSlotRequestDto {
  @ApiPropertyOptional({ description: '시작 시간' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startAt?: Date;

  @ApiPropertyOptional({ description: '종료 시간' })
  @Type(() => Date)
  @IsDate()
  @IsOptional()
  endAt?: Date;

  @ApiPropertyOptional({ description: '수용 인원', minimum: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @ApiPropertyOptional({
    description: '장소. 부분 수정이라 생략할 수 있지만, 보낼 경우 빈 값은 허용하지 않습니다.',
    example: 'https://meet.google.com/abc-defg-hij',
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({ description: '설명' })
  @IsString()
  @IsOptional()
  description?: string;
}

export class InterviewSlotListQueryDto {
  @ApiPropertyOptional({ description: '기수 ID 필터' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  cohortId?: number;

  @ApiPropertyOptional({ description: '기수 파트 ID 필터' })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  cohortPartId?: number;
}
