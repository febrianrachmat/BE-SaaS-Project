import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  it('hashes and verifies a password', async () => {
    const hash = await service.hash('SecurePass1!');
    expect(hash).not.toEqual('SecurePass1!');
    await expect(service.verify('SecurePass1!', hash)).resolves.toBe(true);
    await expect(service.verify('wrong', hash)).resolves.toBe(false);
  });
});
