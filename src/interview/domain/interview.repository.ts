import { Injectable } from '@nestjs/common';

import { InterviewerWriteRepository } from '../infrastructure/interviewer.write.repository';
import { ReservationWriteRepository } from '../infrastructure/reservation.write.repository';
import { SlotWriteRepository } from '../infrastructure/slot.write.repository';
import type {
  ReservationFilter,
  SlotFilter,
  SlotUpdatePatch,
} from '../infrastructure/write.repository.type';
import { InterviewReservation } from './interview-reservation.entity';
import { InterviewSlot } from './interview-slot.entity';

@Injectable()
export class InterviewRepository {
  constructor(
    private readonly slotWriteRepository: SlotWriteRepository,
    private readonly reservationWriteRepository: ReservationWriteRepository,
    private readonly interviewerWriteRepository: InterviewerWriteRepository,
  ) {}

  async saveSlot({ slot }: { slot: InterviewSlot }): Promise<InterviewSlot> {
    return this.slotWriteRepository.save({ slot });
  }

  async findSlotById({ id }: { id: number }) {
    return this.slotWriteRepository.findOne({
      where: { id },
      // cohort 는 확정 안내 메일의 기수명·기한 문구에 쓰인다.
      relations: ['reservations', 'cohortPart', 'cohort', 'interviewers', 'interviewers.user'],
    });
  }

  async findSlotByIdIncludingDeleted({ id }: { id: number }) {
    return this.slotWriteRepository.findOne({
      where: { id },
      relations: ['cohortPart', 'cohort', 'interviewers', 'interviewers.user'],
      withDeleted: true,
    });
  }

  async withSlotMeetingLock({
    slotId,
    work,
  }: {
    slotId: number;
    work: () => Promise<void>;
  }): Promise<void> {
    await this.slotWriteRepository.withMeetingLock({ slotId, work });
  }

  async acquireHostTimeLock({ hostUserId }: { hostUserId: number }): Promise<void> {
    await this.slotWriteRepository.acquireHostTimeLock({ hostUserId });
  }

  async findSlots({ where }: { where?: SlotFilter } = {}) {
    return this.slotWriteRepository.findMany({
      where,
      relations: ['reservations', 'interviewers', 'interviewers.user'],
    });
  }

  async replaceSlotInterviewers({
    slotId,
    userIds,
  }: {
    slotId: number;
    userIds: number[];
  }): Promise<void> {
    await this.interviewerWriteRepository.replace({ slotId, userIds });
  }

  async hasHostTimeConflict({
    hostUserId,
    startAt,
    endAt,
    excludeSlotId,
  }: {
    hostUserId: number;
    startAt: Date;
    endAt: Date;
    excludeSlotId?: number;
  }): Promise<boolean> {
    return this.interviewerWriteRepository.hasHostOverlap({
      hostUserId,
      startAt,
      endAt,
      excludeSlotId,
    });
  }

  async updateMeetingState({
    slotId,
    patch,
    revision,
    bumpRevision,
  }: Parameters<SlotWriteRepository['updateMeetingState']>[0]): Promise<boolean> {
    return this.slotWriteRepository.updateMeetingState({ slotId, patch, revision, bumpRevision });
  }

  async clearStaleMeetingEvent({ slotId, eventId }: { slotId: number; eventId: string }) {
    await this.slotWriteRepository.clearStaleMeetingEvent({ slotId, eventId });
  }

  async findMeetingRetryCandidates({
    now,
    limit,
  }: {
    now: Date;
    limit: number;
  }): Promise<InterviewSlot[]> {
    return this.slotWriteRepository.findRetryCandidates({ now, limit });
  }

  async updateSlot({ id, patch }: { id: number; patch: SlotUpdatePatch }): Promise<void> {
    await this.slotWriteRepository.update({ id, patch });
  }

  async deleteSlot({ id }: { id: number }): Promise<void> {
    await this.slotWriteRepository.softDelete({ id });
  }

  async countSlotsByCohortPartId({ cohortPartId }: { cohortPartId: number }): Promise<number> {
    return this.slotWriteRepository.countByCohortPartId({ cohortPartId });
  }

  async findSlotByIdForUpdate({ id }: { id: number }) {
    return this.slotWriteRepository.findOneForUpdate({ id });
  }

  async saveReservation({
    reservation,
  }: {
    reservation: InterviewReservation;
  }): Promise<InterviewReservation> {
    return this.reservationWriteRepository.save({ reservation });
  }

  async findReservationById({ id }: { id: number }) {
    return this.reservationWriteRepository.findOne({ where: { id }, relations: ['slot'] });
  }

  async findReservationByIdIncludingDeleted({ id }: { id: number }) {
    return this.reservationWriteRepository.findOne({
      where: { id },
      relations: ['slot', 'slot.interviewers'],
      withDeleted: true,
    });
  }

  async findReservations({ where }: { where?: ReservationFilter } = {}) {
    return this.reservationWriteRepository.findMany({ where, relations: ['slot'] });
  }

  async findReservationByApplicationFormId({ applicationFormId }: { applicationFormId: number }) {
    return this.reservationWriteRepository.findOne({
      where: { applicationFormId },
      relations: ['slot'],
    });
  }

  async countActiveReservationsBySlotId({ slotId }: { slotId: number }): Promise<number> {
    return this.reservationWriteRepository.countActiveBySlotId({ slotId });
  }

  async deleteReservation({ id }: { id: number }): Promise<void> {
    await this.reservationWriteRepository.softDelete({ id });
  }
}
