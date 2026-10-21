import { getMetadataArgsStorage } from 'typeorm';

import { EncryptionTransformer } from '../../common/util/encryption.transformer';
import { GoogleCalendarConnection } from './google-calendar-connection.entity';

describe('GoogleCalendarConnection refreshToken', () => {
  it('암호화 transformer가 컬럼에 연결되고 평문으로 되돌릴 수 있다', () => {
    const column = getMetadataArgsStorage().columns.find(
      (metadata) =>
        metadata.target === GoogleCalendarConnection && metadata.propertyName === 'refreshToken',
    );
    const transformer = column?.options.transformer;
    expect(transformer).toBeInstanceOf(EncryptionTransformer);
    if (!(transformer instanceof EncryptionTransformer)) {
      throw new Error('refreshToken transformer is missing');
    }
    EncryptionTransformer.configure({ encryptionKey: 'a'.repeat(64) });
    const encrypted = transformer.to('refresh-token');
    expect(encrypted).not.toContain('refresh-token');
    expect(transformer.from(encrypted)).toBe('refresh-token');
  });
});
