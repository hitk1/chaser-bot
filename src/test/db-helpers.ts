import { prisma } from './prisma';

export async function clearDatabase(): Promise<void> {
  await prisma.message.deleteMany();
  await prisma.rateLimitEntry.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.knowledgeEntry.deleteMany();
}
