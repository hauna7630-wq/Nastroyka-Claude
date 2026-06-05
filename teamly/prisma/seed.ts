import { prisma } from '../src/lib/db';
import { bootstrapOrg } from '../src/lib/services/org';
import { createPage, savePageContent } from '../src/lib/services/pages';

function doc(blocks: object[]) {
  return { type: 'doc', content: blocks };
}

async function main() {
  const email = 'owner@acme.test';
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    console.log('seed: demo user already exists — skipping');
    return;
  }

  const { user, space } = await bootstrapOrg({
    orgName: 'Acme',
    userEmail: email,
    userName: 'Владелец',
    password: 'secret123',
  });

  const onboarding = await createPage({ spaceId: space.id, title: 'Онбординг' });
  await savePageContent({
    pageId: onboarding.id,
    title: 'Онбординг',
    authorId: user.id,
    contentJson: doc([
      { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Добро пожаловать в команду' }] },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Это корпоративная база знаний. Здесь храним регламенты, гайды и материалы для обучения.',
          },
        ],
      },
    ]),
  });

  const tools = await createPage({ spaceId: space.id, parentId: onboarding.id, title: 'Инструменты' });
  await savePageContent({
    pageId: tools.id,
    title: 'Инструменты',
    authorId: user.id,
    contentJson: doc([
      { type: 'paragraph', content: [{ type: 'text', text: 'Список рабочих инструментов и доступы к ним.' }] },
    ]),
  });

  console.log('seed: done. Login → owner@acme.test / secret123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
