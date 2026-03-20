// TODO :: 차후 커서 관련 조회시 사용.
import { FindOptionsWhere } from 'typeorm';

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasNext: boolean;
}

export interface CursorPageOptions<T> {
  cursor?: string;
  limit?: number;
  where?: FindOptionsWhere<T>;
  order?: 'ASC' | 'DESC';
  relations?: string[];
}
