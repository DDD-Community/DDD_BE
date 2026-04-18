import { Injectable } from '@nestjs/common';

import { EmailLogWriteRepository } from '../infrastructure/email-log.write.repository';
import { EmailLog } from './email-log.entity';

@Injectable()
export class NotificationRepository {
  constructor(private readonly emailLogWriteRepository: EmailLogWriteRepository) {}

  async saveLog({ log }: { log: EmailLog }) {
    return this.emailLogWriteRepository.save({ log });
  }
}
