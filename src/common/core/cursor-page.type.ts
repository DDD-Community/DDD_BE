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
