import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from './../src/common/interceptors/transform.interceptor';

describe('API smoke (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/health is alive', async () => {
    const res = await request(app.getHttpServer()).get('/v1/health').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.storageDriver).toBeDefined();
  });

  it('GET /v1/health/ready checks database', async () => {
    const res = await request(app.getHttpServer()).get('/v1/health/ready');
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ready');
      expect(res.body.data.checks.database).toBe('up');
    } else {
      expect(res.body.success).toBe(false);
    }
  });

  it('POST /v1/auth/register rejects invalid body', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ email: 'not-an-email', password: 'short' })
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  it('POST /v1/auth/login rejects bad credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({
        email: 'nobody@example.com',
        password: 'WrongPass1',
      })
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  it('GET /v1/auth/me requires auth', async () => {
    await request(app.getHttpServer()).get('/v1/auth/me').expect(401);
  });

  it('GET /v1/share/:token returns 404 for unknown token', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/share/fps_not_a_real_token')
      .expect(404);
    expect(res.body.success).toBe(false);
  });

  it('GET workspace search requires auth', async () => {
    await request(app.getHttpServer())
      .get('/v1/workspaces/demo/search?q=test')
      .expect(401);
  });

  it('POST bulk tasks requires auth', async () => {
    await request(app.getHttpServer())
      .post('/v1/workspaces/demo/projects/demo/tasks/bulk')
      .send({ action: 'update', taskIds: [], patch: { status: 'TODO' } })
      .expect(401);
  });

  it('GET webhook deliveries requires auth', async () => {
    await request(app.getHttpServer())
      .get(
        '/v1/workspaces/demo/webhooks/00000000-0000-4000-8000-000000000000/deliveries',
      )
      .expect(401);
  });
});
