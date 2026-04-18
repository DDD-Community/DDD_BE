import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import type { ValueTransformer } from 'typeorm';

export class EncryptionTransformer implements ValueTransformer {
  private static readonly ENCRYPTION_KEY_PATTERN = /^[0-9a-f]{64}$/i;
  private static configuredEncryptionKey?: Buffer;
  private readonly algorithm = 'aes-256-gcm';
  private readonly logger = new Logger(EncryptionTransformer.name);

  static configure({ encryptionKey }: { encryptionKey: string }): void {
    if (!EncryptionTransformer.ENCRYPTION_KEY_PATTERN.test(encryptionKey)) {
      throw new Error('ENCRYPTION_KEY는 64자리 hex 문자열이어야 합니다.');
    }

    EncryptionTransformer.configuredEncryptionKey = Buffer.from(encryptionKey, 'hex');
  }

  private get encryptionKey(): Buffer {
    const configuredEncryptionKey = EncryptionTransformer.configuredEncryptionKey;

    if (!configuredEncryptionKey) {
      throw new Error('ENCRYPTION_KEY가 초기화되지 않았습니다.');
    }

    return configuredEncryptionKey;
  }

  to(data: string | null | undefined): string | null {
    if (!data) {
      return null;
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  from(data: string | null | undefined): string | null {
    if (!data) {
      return null;
    }

    try {
      const parts = data.split(':');
      if (parts.length !== 3) {
        throw new Error('암호화 데이터 형식이 올바르지 않습니다.');
      }

      const [ivHex, authTagHex, encryptedHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('복호화 실패 - 암호화 키 불일치 가능성', error);
      throw new Error('복호화에 실패했습니다.');
    }
  }
}
