import { prisma } from '../db';
import { uniqueSlug } from '../slug';
import { extractText, EMPTY_DOC } from '../tiptap';
import { buildPageTree, FlatPage } from '../tree';

export async function createPage(input: {
  spaceId: string;
  parentId?: string | null;
  title: string;
}) {
  const existing = await prisma.page.findMany({
    where: { spaceId: input.spaceId },
    select: { slug: true },
  });
  const slug = uniqueSlug(input.title, existing.map((p) => p.slug));

  const siblings = await prisma.page.count({
    where: { spaceId: input.spaceId, parentId: input.parentId ?? null },
  });

  return prisma.page.create({
    data: {
      spaceId: input.spaceId,
      parentId: input.parentId ?? null,
      title: input.title,
      slug,
      position: siblings,
      contentJson: EMPTY_DOC,
      contentText: '',
    },
  });
}

export async function getPage(pageId: string) {
  return prisma.page.findUnique({ where: { id: pageId } });
}

export async function listTree(spaceId: string) {
  const pages = await prisma.page.findMany({
    where: { spaceId, archived: false },
    select: { id: true, parentId: true, title: true, slug: true, position: true },
  });
  return buildPageTree(pages as FlatPage[]);
}

/**
 * Save new page content as a new version and update the denormalised current
 * content + search text. Returns the new version number.
 */
export async function savePageContent(input: {
  pageId: string;
  title: string;
  contentJson: unknown;
  authorId: string;
}): Promise<number> {
  const last = await prisma.pageVersion.findFirst({
    where: { pageId: input.pageId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;
  const contentText = extractText(input.contentJson);

  await prisma.$transaction([
    prisma.pageVersion.create({
      data: {
        pageId: input.pageId,
        version,
        title: input.title,
        contentJson: input.contentJson as object,
        authorId: input.authorId,
      },
    }),
    prisma.page.update({
      where: { id: input.pageId },
      data: { title: input.title, contentJson: input.contentJson as object, contentText },
    }),
  ]);
  return version;
}

export async function listVersions(pageId: string) {
  return prisma.pageVersion.findMany({
    where: { pageId },
    orderBy: { version: 'desc' },
    select: { version: true, title: true, authorId: true, createdAt: true },
  });
}

export async function movePage(input: {
  pageId: string;
  parentId: string | null;
  position: number;
}) {
  return prisma.page.update({
    where: { id: input.pageId },
    data: { parentId: input.parentId, position: input.position },
  });
}

export async function archivePage(pageId: string) {
  return prisma.page.update({ where: { id: pageId }, data: { archived: true } });
}
