import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import type { ValueTransformer } from 'typeorm';

export class EncryptionTransformer implements ValueTransformer {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly logger = new Logger(EncryptionTransformer.name);

  private get encryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY 환경 변수가 설정되지 않았습니다.');
    }
    let normalizedKey = key;
    if (normalizedKey.length < this.keyLength) {
      normalizedKey = normalizedKey.padEnd(this.keyLength, '0');
    } else if (normalizedKey.length > this.keyLength) {
      normalizedKey = normalizedKey.substring(0, this.keyLength);
    }
    return Buffer.from(normalizedKey, 'utf8');
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
        return data;
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
      return data;
    }
  }
}
