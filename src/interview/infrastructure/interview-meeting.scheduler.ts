import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { InterviewMeetingService } from '../application/interview-meeting.service';
import { InterviewRepository } from '../domain/interview.repository';

@Injectable()
export class InterviewMeetingScheduler {
  private readonly logger = new Logger(InterviewMeetingScheduler.name);

  constructor(
    private readonly interviewRepository: InterviewRepository,
    private readonly meetingService: InterviewMeetingService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async syncPendingMeetings(): Promise<void> {
    try {
      const slots = await this.interviewRepository.findMeetingRetryCandidates({
        now: new Date(),
        limit: 20,
      });
      for (const slot of slots) {
        try {
          await this.meetingService.syncSlotMeeting({ slotId: slot.id });
        } catch {
          this.logger.warn(`면접 회의 재시도 실패 (slotId=${slot.id})`);
        }
      }
    } catch {
      this.logger.warn('면접 회의 재시도 대상 조회 실패');
    }
  }
}
