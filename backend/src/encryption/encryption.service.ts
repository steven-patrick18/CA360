import { Injectable, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * EncryptionService — AES-256-GCM with per-firm derived keys.
 *
 * Design:
 *   - Master key: 32 random bytes (base64) loaded from MASTER_ENCRYPTION_KEY.
 *   - Per-firm key: HKDF-SHA256(masterKey, info=`firm:${firmId}`, len=32).
 *     Same firmId always derives the same key, but a different firm derives a
 *     completely different key — even if you somehow got hold of one firm's
 *     plaintext + ciphertext, you couldn't read another firm's vault.
 *   - Each ciphertext is `v1:base64(iv) : base64(authTag) : base64(ct)`.
 *     The version prefix lets us rotate cipher / KDF later without breaking
 *     stored values (just bump to v2 and migrate on read).
 *
 * Why AES-256-GCM:
 *   - Authenticated encryption — tampering is detected.
 *   - 12-byte IV is the recommended size for GCM.
 *   - Native to node:crypto, no extra dependency.
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private masterKey!: Buffer;

  // Cache derived per-firm keys for the lifetime of the process. Cheap to
  // re-derive but no reason to recompute on every request.
  private readonly firmKeyCache = new Map<string, Buffer>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const raw = this.config.get<string>('MASTER_ENCRYPTION_KEY');
    if (!raw || raw.startsWith('CHANGE_ME') || raw.startsWith('dev_only')) {
      throw new InternalServerErrorException(
        'MASTER_ENCRYPTION_KEY is not set to a real value in .env. ' +
          'Generate one with: [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))',
      );
    }
    const buf = Buffer.from(raw, 'base64');
    if (buf.length !== 32) {
      throw new InternalServerErrorException(
        `MASTER_ENCRYPTION_KEY must decode to exactly 32 bytes (got ${buf.length}).`,
      );
    }
    this.masterKey = buf;
  }

  private deriveFirmKey(firmId: string): Buffer {
    const cached = this.firmKeyCache.get(firmId);
    if (cached) return cached;
    // hkdfSync(digest, ikm, salt, info, keylen) → ArrayBuffer
    const out = hkdfSync('sha256', this.masterKey, Buffer.alloc(0), `firm:${firmId}`, 32);
    const buf = Buffer.from(out);
    this.firmKeyCache.set(firmId, buf);
    return buf;
  }

  encryptForFirm(firmId: string, plaintext: string): string {
    const key = this.deriveFirmKey(firmId);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
  }

  decryptForFirm(firmId: string, ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 4 || parts[0] !== 'v1') {
      throw new InternalServerErrorException('Unrecognized ciphertext version');
    }
    const [, ivB64, tagB64, ctB64] = parts;
    const key = this.deriveFirmKey(firmId);
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const ct = Buffer.from(ctB64, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString('utf8');
  }
}
