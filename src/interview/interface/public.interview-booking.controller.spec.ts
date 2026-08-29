import { Test } from '@nestjs/testing';

import { ApplicationStatus } from '../../application/domain/application.status';
import { ApplicationService } from '../../application/usecase/application.service';
import { InterviewService } from '../application/interview.service';
import type { InterviewBookingTokenPayload } from '../application/interview-booking-token.service';
import { InterviewBookingTokenService } from '../application/interview-booking-token.service';
import { PublicInterviewBookingController } from './public.interview-booking.controller';

const mockInterviewService = {
  findActiveReservationByApplicationFormId: jest.fn(),
  findOpenSlotsForBooking: jest.fn(),
  createReservationByApplicant: jest.fn(),
};

const mockApplicationService = {
  findFormById: jest.fn(),
};

const token: InterviewBookingTokenPayload = {
  purpose: 'interview_booking',
  applicationFormId: 123,
  cohortId: 12,
  cohortPartId: 52,
  partName: 'BE',
  applicantName: '장원석',
};

describe('PublicInterviewBookingController', () => {
  let controller: PublicInterviewBookingController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicInterviewBookingController],
      providers: [
        { provide: InterviewService, useValue: mockInterviewService },
        { provide: ApplicationService, useValue: mockApplicationService },
        { provide: InterviewBookingTokenService, useValue: { verify: jest.fn() } },
      ],
    }).compile();

    controller = module.get(PublicInterviewBookingController);
    jest.clearAllMocks();
  });

  describe('createReservation', () => {
    it('서류합격 상태가 아니면 INTERVIEW_BOOKING_NOT_ELIGIBLE(403)', async () => {
      mockApplicationService.findFormById.mockResolvedValue({
        status: ApplicationStatus.최종불합격,
        applicantName: '장원석',
        user: { email: 'applicant@example.com' },
      });

      await expect(controller.createReservation(token, { slotId: 7 })).rejects.toMatchObject({
        errorCode: 'INTERVIEW_BOOKING_NOT_ELIGIBLE',
      });
      expect(mockInterviewService.createReservationByApplicant).not.toHaveBeenCalled();
    });

    it('서류합격 상태면 토큰 값으로 예약을 생성한다', async () => {
      mockApplicationService.findFormById.mockResolvedValue({
        status: ApplicationStatus.서류합격,
        applicantName: '장원석',
        user: { email: 'applicant@example.com' },
      });
      mockInterviewService.createReservationByApplicant.mockResolvedValue({
        id: 55,
        slotId: 7,
        slot: { startAt: new Date(), endAt: new Date(), location: '서울' },
      });

      await controller.createReservation(token, { slotId: 7 });

      expect(mockInterviewService.createReservationByApplicant).toHaveBeenCalledWith({
        input: {
          slotId: 7,
          applicationFormId: 123,
          cohortPartId: 52,
          applicantName: '장원석',
          applicantEmail: 'applicant@example.com',
        },
      });
    });
  });
});
