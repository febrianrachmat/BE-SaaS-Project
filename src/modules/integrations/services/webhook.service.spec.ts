import { verifyWebhookSignature } from './webhook.service';
import { createHmac } from 'crypto';

describe('verifyWebhookSignature', () => {
  const secret = 'test-secret';
  const timestamp = '1710000000';
  const body = JSON.stringify({ event: 'task.updated', data: { id: '1' } });
  const signed = `${timestamp}.${body}`;

  it('accepts a valid sha256 signature', () => {
    const hex = createHmac('sha256', secret).update(signed).digest('hex');
    expect(verifyWebhookSignature(secret, signed, `sha256=${hex}`)).toBe(true);
    expect(verifyWebhookSignature(secret, signed, hex)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const hex = createHmac('sha256', secret).update(signed).digest('hex');
    expect(
      verifyWebhookSignature(secret, `${timestamp}.{bad}`, `sha256=${hex}`),
    ).toBe(false);
  });

  it('rejects a wrong secret', () => {
    const hex = createHmac('sha256', secret).update(signed).digest('hex');
    expect(verifyWebhookSignature('other', signed, `sha256=${hex}`)).toBe(
      false,
    );
  });
});
