// Production seed: creates the first org + owner user so you can log in.
// Self-contained (only @prisma/client + bcryptjs, both present in the standalone
// runtime image) — unlike prisma/seed.ts it needs no ts-node / service layer.
// Idempotent: re-running it is a no-op once the user exists.
//
//   docker compose -f docker-compose.prod.yml exec teamly node prisma/seed.prod.cjs
//
// Login afterwards: owner@acme.test / secret123  (change the password in-app).

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const EMAIL = 'owner@acme.test';
const PASSWORD = 'secret123';

async function main() {
  const existing = await prisma.user.findFirst({ where: { email: EMAIL } });
  if (existing) {
    console.log('seed: user already exists — skipping');
    return;
  }
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await prisma.$transaction(async (tx) => {
    const org = await tx.org.create({ data: { name: 'Acme' } });
    const user = await tx.user.create({
      data: { orgId: org.id, email: EMAIL, name: 'Владелец', passwordHash },
    });
    const workspace = await tx.workspace.create({
      data: { orgId: org.id, name: 'Главное пространство', slug: 'main' },
    });
    await tx.membership.create({
      data: { orgId: org.id, userId: user.id, workspaceId: workspace.id, role: 'owner' },
    });
    await tx.space.create({
      data: { workspaceId: workspace.id, name: 'База знаний', slug: 'kb' },
    });
  });
  console.log(`seed: done. Login -> ${EMAIL} / ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
