import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from '../auth/services/mail.service';
import { OBJECT_STORAGE } from '../../infrastructure/storage/storage.module';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: MailService,
          useValue: { isConfigured: () => false },
        },
        {
          provide: OBJECT_STORAGE,
          useValue: { driver: 'local' },
        },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns ok status payload', () => {
    const result = controller.check();
    expect(result).toEqual(
      expect.objectContaining({
        status: 'ok',
        mailConfigured: false,
        storageDriver: 'local',
      }),
    );
  });
});
