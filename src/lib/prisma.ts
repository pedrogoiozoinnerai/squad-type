import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL não configurada — veja .env.example.");
  }

  // Em runtime usamos a URL do pooler (porta 6543). Serverless abre muitas
  // conexões curtas; sem pooler o Postgres do Supabase esgota o limite.
  // `max: 1` porque cada instância da função serverless é um processo próprio:
  // pool grande aqui multiplica conexões em vez de reaproveitá-las.
  const adapter = new PrismaPg({ connectionString, max: 1 });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
