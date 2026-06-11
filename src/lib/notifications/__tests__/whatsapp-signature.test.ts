import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyWhatsAppSignature } from '../whatsapp-signature';

const APP_SECRET = 'unit-test-app-secret';

const RAW_BODY = JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '102290129340398',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            messages: [
              { from: '61400000000', id: 'wamid.test1', timestamp: '1718064000', type: 'text', text: { body: 'STATUS' } },
            ],
          },
        },
      ],
    },
  ],
});

function sign(body: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;
}

describe('verifyWhatsAppSignature', () => {
  it('accepts a valid signature over the raw body', () => {
    expect(verifyWhatsAppSignature(RAW_BODY, sign(RAW_BODY, APP_SECRET), APP_SECRET)).toBe(true);
  });

  it('accepts an uppercase hex digest (hex compare is case-insensitive)', () => {
    const header = sign(RAW_BODY, APP_SECRET);
    const upper = `sha256=${header.slice('sha256='.length).toUpperCase()}`;
    expect(verifyWhatsAppSignature(RAW_BODY, upper, APP_SECRET)).toBe(true);
  });

  it('rejects when the body was tampered with after signing', () => {
    const header = sign(RAW_BODY, APP_SECRET);
    const tampered = RAW_BODY.replace('STATUS', 'APPROVE EVIL-CODE');
    expect(verifyWhatsAppSignature(tampered, header, APP_SECRET)).toBe(false);
  });

  it('rejects a signature produced with the wrong secret', () => {
    const header = sign(RAW_BODY, 'some-other-secret');
    expect(verifyWhatsAppSignature(RAW_BODY, header, APP_SECRET)).toBe(false);
  });

  it('rejects when the header is missing (null)', () => {
    expect(verifyWhatsAppSignature(RAW_BODY, null, APP_SECRET)).toBe(false);
  });

  it('rejects an empty header', () => {
    expect(verifyWhatsAppSignature(RAW_BODY, '', APP_SECRET)).toBe(false);
  });

  it('rejects a header without the sha256= prefix', () => {
    const bareDigest = createHmac('sha256', APP_SECRET).update(RAW_BODY, 'utf8').digest('hex');
    expect(verifyWhatsAppSignature(RAW_BODY, bareDigest, APP_SECRET)).toBe(false);
  });

  it('rejects a truncated digest', () => {
    const header = sign(RAW_BODY, APP_SECRET).slice(0, -2);
    expect(verifyWhatsAppSignature(RAW_BODY, header, APP_SECRET)).toBe(false);
  });

  it('rejects non-hex garbage after the prefix', () => {
    expect(verifyWhatsAppSignature(RAW_BODY, `sha256=${'z'.repeat(64)}`, APP_SECRET)).toBe(false);
  });

  it('fails closed when the app secret is unset', () => {
    const header = sign(RAW_BODY, APP_SECRET);
    expect(verifyWhatsAppSignature(RAW_BODY, header, undefined)).toBe(false);
  });

  it('fails closed when the app secret is an empty string', () => {
    const header = sign(RAW_BODY, APP_SECRET);
    expect(verifyWhatsAppSignature(RAW_BODY, header, '')).toBe(false);
  });
});
