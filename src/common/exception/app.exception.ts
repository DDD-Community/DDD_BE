import { HttpException, HttpStatus } from '@nestjs/common';

import { ErrorMessage, ErrorMessageKey } from '../error/error-message';

export class AppException extends HttpException {
  readonly errorCode: ErrorMessageKey;

  constructor(errorCode: ErrorMessageKey, status: HttpStatus, message?: string) {
    super(message ?? ErrorMessage[errorCode], status);
    this.errorCode = errorCode;
  }
}
