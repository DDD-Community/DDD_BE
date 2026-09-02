import { Test } from '@nestjs/testing';

import { InterviewService } from '../application/interview.service';
import type { InterviewBookingTokenPayload } from '../application/interview-booking-token.service';
import { InterviewBookingTokenService } from '../application/interview-booking-token.service';
import { PublicInterviewBookingController } from './public.interview-booking.controller';

const mockInterviewService = {
  findActiveReservationByApplicationFormId: jest.fn(),
  findOpenSlotsForBooking: jest.fn(),
  createReservationByApplicant: jest.fn(),
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
        { provide: InterviewBookingTokenService, useValue: { verify: jest.fn() } },
      ],
    }).compile();

    controller = module.get(PublicInterviewBookingController);
    jest.clearAllMocks();
  });

  describe('createReservation', () => {
    it('지원서를 직접 읽지 않고 토큰 값만 서비스에 넘긴다', async () => {
      // 자격 검증은 예약 트랜잭션 안에서 지원서 행을 잠근 뒤 수행된다.
      // 컨트롤러가 미리 조회하면 TOCTOU 경쟁이 생기므로 여기서 읽지 않는 것이 계약이다.
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
        },
      });
    });

    it('서비스가 던진 자격 미달 예외를 그대로 전파한다', async () => {
      mockInterviewService.createReservationByApplicant.mockRejectedValue(
        Object.assign(new Error('not eligible'), {
          errorCode: 'INTERVIEW_BOOKING_NOT_ELIGIBLE',
        }),
      );

      await expect(controller.createReservation(token, { slotId: 7 })).rejects.toMatchObject({
        errorCode: 'INTERVIEW_BOOKING_NOT_ELIGIBLE',
      });
    });
  });

  describe('getContext', () => {
    it('토큰의 이름·직군과 기존 예약을 반환한다', async () => {
      mockInterviewService.findActiveReservationByApplicationFormId.mockResolvedValue(null);

      const result = await controller.getContext(token);

      expect(mockInterviewService.findActiveReservationByApplicationFormId).toHaveBeenCalledWith({
        applicationFormId: 123,
      });
      expect(result.data).toMatchObject({
        applicantName: '장원석',
        partName: 'BE',
        reservation: null,
      });
    });
  });

  describe('listSlots', () => {
    it('토큰의 직군으로만 슬롯을 조회한다', async () => {
      mockInterviewService.findOpenSlotsForBooking.mockResolvedValue([]);

      await controller.listSlots(token);

      expect(mockInterviewService.findOpenSlotsForBooking).toHaveBeenCalledWith({
        cohortPartId: 52,
      });
    });
  });
});
