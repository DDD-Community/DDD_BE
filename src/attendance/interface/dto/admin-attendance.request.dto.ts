import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import type { AttendanceInvitationType } from '../../domain/attendance.type';
import { ATTENDANCE_INVITATION_TYPES } from '../../domain/attendance.type';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateAttendanceGenerationRequestDto {
  @ApiProperty({ example: '15기', maxLength: 5 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5)
  name: string;
}

export class CreateAttendanceTeamRequestDto {
  @ApiProperty({ example: '1팀', maxLength: 30 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  name: string;

  @ApiPropertyOptional({ example: '서비스명', maxLength: 100 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  serviceName?: string;
}

export class CreateAttendanceInvitationRequestDto {
  @ApiProperty({ enum: ATTENDANCE_INVITATION_TYPES })
  @IsIn(ATTENDANCE_INVITATION_TYPES)
  type: AttendanceInvitationType;

  @ApiPropertyOptional({ minLength: 4, maxLength: 50, pattern: '^[A-Za-z0-9_-]{4,50}$' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{4,50}$/)
  code?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
