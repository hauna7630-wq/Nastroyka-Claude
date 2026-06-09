// Re-embed all pages (e.g. after seeding or changing the embedder).

import { prisma } from '../src/lib/db';
import { reindexSpace } from '../src/lib/services/indexing';

async function main() {
  const spaces = await prisma.space.findMany({ select: { id: true, name: true } });
  let total = 0;
  for (const s of spaces) {
    const n = await reindexSpace(s.id);
    total += n;
    console.log(`reindexed "${s.name}": ${n} chunks`);
  }
  console.log(`done. total chunks: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
