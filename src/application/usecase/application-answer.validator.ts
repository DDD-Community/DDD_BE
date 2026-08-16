import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException } from '../../common/exception/app.exception';

@Injectable()
export class ApplicationAnswerValidator {
  validate({
    answers,
    schema,
  }: {
    answers: Record<string, unknown>;
    schema: Record<string, unknown>;
  }): void {
    const requiredKeys = this.collectRequiredKeys(schema);

    if (requiredKeys.size === 0) {
      return;
    }

    const missingKeys = [...requiredKeys].filter((key) => !this.hasValue(answers[key]));
    if (missingKeys.length > 0) {
      throw new AppException('INVALID_APPLICATION_ANSWERS', HttpStatus.BAD_REQUEST);
    }
  }

  private collectRequiredKeys(schema: Record<string, unknown>) {
    const requiredKeys = new Set<string>();
    const schemaRequired = schema.required;

    if (Array.isArray(schemaRequired)) {
      for (const item of schemaRequired) {
        if (typeof item === 'string' && item.trim().length > 0) {
          requiredKeys.add(item);
        }
      }
    }

    const questions = schema.questions;
    if (!Array.isArray(questions)) {
      return requiredKeys;
    }

    for (const question of questions) {
      if (!question || typeof question !== 'object') {
        continue;
      }

      const normalizedQuestion = question as Record<string, unknown>;
      const keyCandidate = this.findQuestionKey(normalizedQuestion);

      if (normalizedQuestion.required === true && keyCandidate) {
        requiredKeys.add(keyCandidate);
      }
    }

    return requiredKeys;
  }

  private findQuestionKey(question: Record<string, unknown>) {
    const keyCandidates = [question.key, question.name, question.id];

    return keyCandidates.find(
      (candidate): candidate is string =>
        typeof candidate === 'string' && candidate.trim().length > 0,
    );
  }

  private hasValue(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    // 파일 첨부 답변은 { path, originalName, size } 형태로 들어온다.
    // path 가 비어 있으면 첨부하지 않은 것으로 본다.
    if (typeof value === 'object' && 'path' in value) {
      const path = (value as { path: unknown }).path;
      return typeof path === 'string' && path.trim().length > 0;
    }

    return true;
  }
}
