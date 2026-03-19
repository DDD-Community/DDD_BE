import { ErrorMessageKey } from '../error/error-message';

export type ResponseCode = ErrorMessageKey | 'SUCCESS';

export interface ResponseMeta {
  requestId?: string;
}
