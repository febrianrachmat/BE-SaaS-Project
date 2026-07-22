import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from '../auth/services/mail.service';
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
      }),
    );
  });
});
