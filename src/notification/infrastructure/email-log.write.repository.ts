import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { EmailLog } from '../domain/email-log.entity';

@Injectable()
export class EmailLogWriteRepository {
  private readonly repository: Repository<EmailLog>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(EmailLog);
  }

  async save({ log }: { log: EmailLog }) {
    return this.repository.save(log);
  }
}
