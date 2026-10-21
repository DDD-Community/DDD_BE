import { Injectable } from '@nestjs/common';

import { GoogleCalendarConnectionWriteRepository } from '../infrastructure/google-calendar-connection.write.repository';
import { GoogleCalendarConnection } from './google-calendar-connection.entity';
import { GoogleCalendarConnectionStatus } from './google-calendar-connection.status';

@Injectable()
export class GoogleCalendarConnectionRepository {
  constructor(private readonly writeRepository: GoogleCalendarConnectionWriteRepository) {}

  async findByUserId({ userId }: { userId: number }) {
    return this.writeRepository.findOne({ userId });
  }

  async findByUserIds({ userIds }: { userIds: number[] }) {
    return this.writeRepository.findMany({ userIds });
  }

  async saveConnection({ connection }: { connection: GoogleCalendarConnection }) {
    return this.writeRepository.save({ connection });
  }

  async disconnect({ userId }: { userId: number }): Promise<void> {
    await this.writeRepository.delete({ userId });
  }

  async recordError({
    connection,
    error,
    invalid,
  }: {
    connection: GoogleCalendarConnection;
    error: string;
    invalid: boolean;
  }): Promise<void> {
    await this.writeRepository.updateError({
      id: connection.id,
      connectedAt: connection.connectedAt,
      patch: {
        lastErrorAt: new Date(),
        lastError: error,
        ...(invalid ? { status: GoogleCalendarConnectionStatus.INVALID } : {}),
      },
    });
  }
}
