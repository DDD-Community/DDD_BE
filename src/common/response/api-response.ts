import { ErrorMessageKey } from '../error/error-message';
import { ResponseCode, ResponseMeta } from './api-response.type';

export class ApiResponse<T> {
  readonly code: ResponseCode;
  readonly message: string;
  readonly data: T | null;
  readonly meta?: ResponseMeta;

  private constructor(code: ResponseCode, message: string, data: T | null, meta?: ResponseMeta) {
    this.code = code;
    this.message = message;
    this.data = data;
    this.meta = meta;
  }

  static ok<T>(data: T, message = 'success', meta?: ResponseMeta): ApiResponse<T> {
    return new ApiResponse('SUCCESS', message, data, meta);
  }

  static fail(code: ErrorMessageKey, message: string, meta?: ResponseMeta): ApiResponse<null> {
    return new ApiResponse(code, message, null, meta);
  }
}
