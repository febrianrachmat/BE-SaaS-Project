import { MailOutboxService } from './mail-outbox.service';

describe('MailOutboxService', () => {
  it('runs jobs sequentially', async () => {
    const outbox = new MailOutboxService();
    const order: number[] = [];

    outbox.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push(1);
    });
    outbox.enqueue(async () => {
      order.push(2);
    });

    await new Promise((r) => setTimeout(r, 80));
    expect(order).toEqual([1, 2]);
    await outbox.onModuleDestroy();
  });

  it('swallows job errors and continues', async () => {
    const outbox = new MailOutboxService();
    let ran = false;

    outbox.enqueue(async () => {
      throw new Error('smtp down');
    });
    outbox.enqueue(async () => {
      ran = true;
    });

    await new Promise((r) => setTimeout(r, 40));
    expect(ran).toBe(true);
    await outbox.onModuleDestroy();
  });
});
