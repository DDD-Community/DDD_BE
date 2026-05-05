import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { calendar_v3, google } from 'googleapis';

type CreateEventPayload = {
  summary: string;
  description?: string;
  startAt: Date;
  endAt: Date;
  location?: string;
};

type UpdateEventPayload = {
  eventId: string;
  summary?: string;
  description?: string;
  startAt?: Date;
  endAt?: Date;
  location?: string;
};

@Injectable()
export class GoogleCalendarClient {
  private readonly logger = new Logger(GoogleCalendarClient.name);
  private readonly calendar: calendar_v3.Calendar | null = null;
  private readonly calendarId: string | null = null;

  constructor(private readonly configService: ConfigService) {
    const provider = (
      this.configService.get<string>('CALENDAR_PROVIDER') ?? 'console'
    ).toLowerCase();

    if (provider === 'google') {
      const keyFilename = this.configService.get<string>('GOOGLE_CALENDAR_KEY_FILE_PATH');
      const calendarId = this.configService.get<string>('GOOGLE_CALENDAR_ID');

      if (!keyFilename || !calendarId) {
        throw new Error(
          'CALENDAR_PROVIDER=google 이지만 GOOGLE_CALENDAR_KEY_FILE_PATH 또는 GOOGLE_CALENDAR_ID가 누락되었습니다.',
        );
      }

      const auth = new google.auth.GoogleAuth({
        keyFilename,
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });
      this.calendar = google.calendar({ version: 'v3', auth });
      this.calendarId = calendarId;
    }
  }

  async createEvent({
    summary,
    description,
    startAt,
    endAt,
    location,
  }: CreateEventPayload): Promise<string> {
    if (!this.calendar || !this.calendarId) {
      const previewId = `preview-${Date.now()}`;
      this.logger.log(
        `[캘린더 미리보기] summary=${summary}, start=${startAt.toISOString()}, eventId=${previewId}`,
      );
      return previewId;
    }

    const response = await this.calendar.events.insert({
      calendarId: this.calendarId,
      requestBody: {
        summary,
        description,
        location,
        start: { dateTime: startAt.toISOString(), timeZone: 'Asia/Seoul' },
        end: { dateTime: endAt.toISOString(), timeZone: 'Asia/Seoul' },
      },
    });

    if (!response.data.id) {
      throw new Error('Google Calendar event creation returned no id');
    }

    return response.data.id;
  }

  async updateEvent({
    eventId,
    summary,
    description,
    startAt,
    endAt,
    location,
  }: UpdateEventPayload): Promise<void> {
    if (!this.calendar || !this.calendarId) {
      this.logger.log(
        `[캘린더 미리보기] update eventId=${eventId}, start=${startAt?.toISOString() ?? '(unchanged)'}`,
      );
      return;
    }

    const requestBody: calendar_v3.Schema$Event = {};
    if (summary !== undefined) {
      requestBody.summary = summary;
    }
    if (description !== undefined) {
      requestBody.description = description;
    }
    if (location !== undefined) {
      requestBody.location = location;
    }
    if (startAt !== undefined) {
      requestBody.start = { dateTime: startAt.toISOString(), timeZone: 'Asia/Seoul' };
    }
    if (endAt !== undefined) {
      requestBody.end = { dateTime: endAt.toISOString(), timeZone: 'Asia/Seoul' };
    }

    await this.calendar.events.patch({
      calendarId: this.calendarId,
      eventId,
      requestBody,
    });
  }

  async deleteEvent({ eventId }: { eventId: string }): Promise<void> {
    if (!this.calendar || !this.calendarId) {
      this.logger.log(`[캘린더 미리보기] delete eventId=${eventId}`);
      return;
    }

    await this.calendar.events.delete({
      calendarId: this.calendarId,
      eventId,
    });
  }
}
