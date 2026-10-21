import { Injectable } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';

import { GoogleCalendarConnection } from '../domain/google-calendar-connection.entity';

@Injectable()
export class GoogleCalendarConnectionWriteRepository {
  private readonly repository: Repository<GoogleCalendarConnection>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(GoogleCalendarConnection);
  }

  async findOne({ userId }: { userId: number }) {
    return this.repository.findOne({ where: { userId } });
  }

  async findMany({ userIds }: { userIds: number[] }): Promise<GoogleCalendarConnection[]> {
    if (userIds.length === 0) {
      return [];
    }
    return this.repository.find({ where: { userId: In(userIds) } });
  }

  async save({ connection }: { connection: GoogleCalendarConnection }) {
    return this.repository.save(connection);
  }

  async delete({ userId }: { userId: number }): Promise<void> {
    await this.repository.delete({ userId });
  }

  /**
   * 같은 연결(같은 행 + 같은 연결 시각)일 때만 오류를 기록한다.
   * 요청 도중 해제되거나 다시 연결됐으면 0건 갱신으로 끝나, 지운 행을 되살리거나 새 토큰을 덮지 않는다.
   */
  async updateError({
    id,
    connectedAt,
    patch,
  }: {
    id: number;
    connectedAt: Date;
    patch: Pick<GoogleCalendarConnection, 'lastErrorAt' | 'lastError'> &
      Partial<Pick<GoogleCalendarConnection, 'status'>>;
  }): Promise<void> {
    await this.repository.update({ id, connectedAt }, patch);
  }
}
