import { prisma } from '../db';

export async function addComment(input: { pageId: string; authorId: string; body: string }) {
  const body = input.body.trim();
  if (!body) throw new Error('comment body is empty');
  return prisma.comment.create({
    data: { pageId: input.pageId, authorId: input.authorId, body },
  });
}

export async function listComments(pageId: string) {
  return prisma.comment.findMany({
    where: { pageId },
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { name: true } } },
  });
}
