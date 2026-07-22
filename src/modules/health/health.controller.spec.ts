import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let health: { live: jest.Mock; ready: jest.Mock };

  beforeEach(async () => {
    health = {
      live: jest.fn().mockReturnValue({
        status: 'ok',
        mailConfigured: false,
        storageDriver: 'local',
      }),
      ready: jest.fn().mockResolvedValue({
        status: 'ready',
        checks: { database: 'up' },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: health }],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns liveness payload', () => {
    expect(controller.live()).toEqual(
      expect.objectContaining({ status: 'ok' }),
    );
  });

  it('returns readiness payload', async () => {
    await expect(controller.ready()).resolves.toEqual(
      expect.objectContaining({ status: 'ready' }),
    );
  });

  it('surfaces readiness failures', async () => {
    health.ready.mockRejectedValue(
      new ServiceUnavailableException('Service not ready'),
    );
    await expect(controller.ready()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
