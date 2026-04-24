import { Injectable } from '@nestjs/common';

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
  ) {}

  async saveSlot({ slot }: { slot: InterviewSlot }): Promise<InterviewSlot> {
    return this.slotWriteRepository.save({ slot });
  }

  async findSlotById({ id }: { id: number }) {
    return this.slotWriteRepository.findOne({
      where: { id },
      relations: ['reservations', 'cohortPart'],
    });
  }

  async findSlots({ where }: { where?: SlotFilter } = {}) {
    return this.slotWriteRepository.findMany({ where, relations: ['reservations'] });
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
