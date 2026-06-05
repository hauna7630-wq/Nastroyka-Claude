import { prisma } from '../db';
import { uniqueSlug } from '../slug';

export async function listWorkspaces(orgId: string) {
  return prisma.workspace.findMany({ where: { orgId }, orderBy: { createdAt: 'asc' } });
}

export async function listSpaces(workspaceId: string) {
  return prisma.space.findMany({ where: { workspaceId }, orderBy: { createdAt: 'asc' } });
}

export async function getSpace(spaceId: string) {
  return prisma.space.findUnique({ where: { id: spaceId } });
}

export async function createSpace(workspaceId: string, name: string) {
  const existing = await prisma.space.findMany({
    where: { workspaceId },
    select: { slug: true },
  });
  const slug = uniqueSlug(name, existing.map((s) => s.slug));
  return prisma.space.create({ data: { workspaceId, name, slug } });
}
