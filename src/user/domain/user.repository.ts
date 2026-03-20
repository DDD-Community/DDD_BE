import { Injectable } from '@nestjs/common';

import { WriteRepository } from '../infrastructure/write.repository';
import { UserType } from './user.type';

@Injectable()
export class UserRepository {
  constructor(private readonly writeRepository: WriteRepository) {}

  async findByEmail({ email }: { email: string }) {
    return this.writeRepository.findOne({ email });
  }

  async register({ email, firstName, lastName, sub }: UserType) {
    return this.writeRepository.create({ user: { email, firstName, lastName, sub } });
  }
}
