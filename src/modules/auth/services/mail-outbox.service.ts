import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

const MAX_QUEUE = 500;

/**
 * In-process concurrency-1 mail queue so notification SMTP does not block HTTP.
 */
@Injectable()
export class MailOutboxService implements OnModuleDestroy {
  private readonly logger = new Logger(MailOutboxService.name);
  private readonly queue: Array<() => Promise<void>> = [];
  private draining = false;
  private stopped = false;

  enqueue(job: () => Promise<void>): boolean {
    if (this.stopped) {
      void job().catch((err) =>
        this.logger.warn(
          `Mail job after shutdown: ${
            err instanceof Error ? err.message : String(err)
          }`,
        ),
      );
      return true;
    }
    if (this.queue.length >= MAX_QUEUE) {
      this.logger.warn('Mail outbox full; dropping notification email job');
      return false;
    }
    this.queue.push(job);
    this.kick();
    return true;
  }

  private kick(): void {
    if (this.draining) return;
    this.draining = true;
    setImmediate(() => {
      void this.drain();
    });
  }

  private async drain(): Promise<void> {
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;
      try {
        await job();
      } catch (err) {
        this.logger.warn(
          `Mail outbox job failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    this.draining = false;
    if (this.queue.length > 0) this.kick();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    // Best-effort flush of remaining jobs
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;
      try {
        await job();
      } catch {
        // ignore on shutdown
      }
    }
  }
}
