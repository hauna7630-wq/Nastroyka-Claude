// Org/user bootstrap + login. Used by the seed script and the (future) signup flow.

import { prisma } from '../db';
import { hashPassword, verifyPassword } from '../auth';
import { Role } from '../rbac';

export interface BootstrapInput {
  orgName: string;
  userEmail: string;
  userName: string;
  password: string;
}

export async function bootstrapOrg(input: BootstrapInput) {
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    const org = await tx.org.create({ data: { name: input.orgName } });
    const user = await tx.user.create({
      data: {
        orgId: org.id,
        email: input.userEmail.toLowerCase(),
        name: input.userName,
        passwordHash,
      },
    });
    const workspace = await tx.workspace.create({
      data: { orgId: org.id, name: 'Главное пространство', slug: 'main' },
    });
    await tx.membership.create({
      data: { orgId: org.id, userId: user.id, workspaceId: workspace.id, role: 'owner' },
    });
    const space = await tx.space.create({
      data: { workspaceId: workspace.id, name: 'База знаний', slug: 'kb' },
    });
    return { org, user, workspace, space };
  });
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findFirst({ where: { email: email.toLowerCase() } });
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  return ok ? user : null;
}

export async function getUser(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

// The user's role in a workspace (null if not a member).
export async function roleInWorkspace(
  userId: string,
  workspaceId: string,
): Promise<Role | null> {
  const m = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  return (m?.role as Role) ?? null;
}
