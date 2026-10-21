import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  CalendarConnectionStatusResult,
  TestMeetingResult,
} from '../../application/google-calendar-connection.service';
import { GoogleCalendarConnectionStatus } from '../../domain/google-calendar-connection.status';

export class GoogleCalendarAuthorizationResponseDto {
  @ApiProperty({ description: 'Google OAuth 인증 주소' })
  authorizationUrl: string;
}

export class GoogleCalendarStatusResponseDto implements CalendarConnectionStatusResult {
  @ApiProperty()
  connected: boolean;

  @ApiPropertyOptional({ enum: GoogleCalendarConnectionStatus, nullable: true })
  status: GoogleCalendarConnectionStatus | null;

  @ApiPropertyOptional({ nullable: true })
  googleEmail: string | null;

  @ApiPropertyOptional({ nullable: true })
  connectedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  lastError: string | null;
}

export class TestMeetingResponseDto implements TestMeetingResult {
  @ApiProperty()
  eventId: string;

  @ApiProperty()
  htmlLink: string;

  @ApiPropertyOptional({ nullable: true })
  meetUrl: string | null;

  @ApiPropertyOptional({ nullable: true })
  conferenceStatus: string | null;

  @ApiProperty()
  startAt: Date;

  @ApiProperty()
  endAt: Date;
}
