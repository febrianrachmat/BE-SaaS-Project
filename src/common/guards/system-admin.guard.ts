import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '../decorators/current-user.decorator';

export const SYSTEM_ADMIN_KEY = 'systemAdmin';
export const RequireSystemAdmin = () => SetMetadata(SYSTEM_ADMIN_KEY, true);

@Injectable()
export class SystemAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(SYSTEM_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!request.user || request.user.systemRole !== 'SYSTEM_ADMIN') {
      throw new ForbiddenException('System admin access required');
    }
    return true;
  }
}
