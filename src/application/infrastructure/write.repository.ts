import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

import { ApplicationDraft } from '../domain/application-draft.entity';
import { ApplicationForm } from '../domain/application-form.entity';

@Injectable()
export class WriteRepository {
  constructor(
    @InjectRepository(ApplicationForm)
    private readonly formRepository: Repository<ApplicationForm>,
    @InjectRepository(ApplicationDraft)
    private readonly draftRepository: Repository<ApplicationDraft>,
  ) {}

  async saveForm({ form }: { form: ApplicationForm }) {
    return this.formRepository.save(form);
  }

  async findOneForm({ where }: { where: FindOptionsWhere<ApplicationForm> }) {
    return this.formRepository.findOne({
      where,
      relations: ['user', 'cohortPart'],
    });
  }

  async findForms({ where }: { where?: FindOptionsWhere<ApplicationForm> } = {}) {
    return this.formRepository.find({
      where,
      relations: ['user', 'cohortPart'],
      order: { id: 'DESC' },
    });
  }

  async saveDraftRecord({ draft }: { draft: ApplicationDraft }) {
    return this.draftRepository.save(draft);
  }

  async findOneDraft({ where }: { where: FindOptionsWhere<ApplicationDraft> }) {
    return this.draftRepository.findOne({ where });
  }

  async softDeleteDraft({ where }: { where: FindOptionsWhere<ApplicationDraft> }) {
    await this.draftRepository.softDelete(where);
  }
}
