import { EncryptionTransformer } from './encryption.transformer';

type EncryptionTransformerStatic = {
  configuredEncryptionKey?: Buffer;
};

const setConfiguredEncryptionKey = (value?: Buffer): void => {
  (EncryptionTransformer as unknown as EncryptionTransformerStatic).configuredEncryptionKey = value;
};

const VALID_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('EncryptionTransformer', () => {
  beforeEach(() => {
    setConfiguredEncryptionKey(undefined);
  });

  describe('configure', () => {
    it('64자리 hex 문자열이 아니면 예외를 던진다', () => {
      expect(() => {
        EncryptionTransformer.configure({
          encryptionKey: 'too-short',
        });
      }).toThrow('ENCRYPTION_KEY는 64자리 hex 문자열이어야 합니다.');
    });

    it('유효한 키로 암복호화를 수행한다', () => {
      EncryptionTransformer.configure({
        encryptionKey: VALID_ENCRYPTION_KEY,
      });

      const transformer = new EncryptionTransformer();
      const encrypted = transformer.to('secret-value');
      const decrypted = transformer.from(encrypted);

      expect(encrypted).not.toBe('secret-value');
      expect(decrypted).toBe('secret-value');
    });

    it('복호화 데이터 형식이 잘못되면 예외를 던진다', () => {
      EncryptionTransformer.configure({
        encryptionKey: VALID_ENCRYPTION_KEY,
      });

      const transformer = new EncryptionTransformer();

      expect(() => {
        transformer.from('malformed-data');
      }).toThrow('복호화에 실패했습니다.');
    });
  });

  describe('initialization', () => {
    it('초기화되지 않은 상태에서 암호화를 시도하면 예외를 던진다', () => {
      const transformer = new EncryptionTransformer();

      expect(() => {
        transformer.to('secret-value');
      }).toThrow('ENCRYPTION_KEY가 초기화되지 않았습니다.');
    });
  });
});
