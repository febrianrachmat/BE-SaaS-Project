import { User } from '@prisma/client';

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  timezone: string;
  locale: string;
  theme: string;
  hasPassword: boolean;
  systemRole: string;
  emailVerifiedAt: string | null;
  createdAt: string;
};

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    timezone: user.timezone,
    locale: user.locale,
    theme: user.theme,
    hasPassword: Boolean(user.passwordHash),
    systemRole: user.systemRole,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
