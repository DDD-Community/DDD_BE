import { HttpStatus } from '@nestjs/common';

import { AppException } from '../../common/exception/app.exception';
import { ApplicationAnswerValidator } from './application-answer.validator';

describe('ApplicationAnswerValidator', () => {
  const applicationAnswerValidator = new ApplicationAnswerValidator();

  describe('validate', () => {
    it('questions 기반 필수 응답이 누락되면 예외를 던진다', () => {
      expect(() =>
        applicationAnswerValidator.validate({
          answers: { motivation: '지원 동기' },
          schema: {
            questions: [
              { key: 'motivation', required: true },
              { name: 'portfolioUrl', required: true },
            ],
          },
        }),
      ).toThrow(new AppException('INVALID_APPLICATION_ANSWERS', HttpStatus.BAD_REQUEST));
    });

    it('required와 questions에서 수집한 필수 응답이 모두 있으면 통과한다', () => {
      expect(() =>
        applicationAnswerValidator.validate({
          answers: {
            motivation: '지원 동기',
            portfolioUrl: 'https://example.com',
            favoriteStacks: ['nestjs'],
          },
          schema: {
            required: ['motivation'],
            questions: [
              { name: 'portfolioUrl', required: true },
              { id: 'favoriteStacks', required: true },
            ],
          },
        }),
      ).not.toThrow();
    });
  });
});
