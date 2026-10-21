import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleCalendarCallbackQueryDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  error?: string;
}

export class TestMeetingRequestDto {
  @ApiPropertyOptional({ description: '테스트 초대 이메일, 최대 5개', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsEmail({}, { each: true })
  attendeeEmails?: string[];
}

export class TestMeetingEventParamDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;
}
