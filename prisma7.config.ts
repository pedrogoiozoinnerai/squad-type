import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migração usa a conexão DIRETA (porta 5432). O pooler do Supabase
    // (6543, PgBouncer em modo transaction) não suporta os comandos DDL e as
    // sessões longas que o `prisma migrate` precisa. Em runtime é o contrário:
    // a aplicação usa o pooler (ver src/lib/prisma.ts).
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
