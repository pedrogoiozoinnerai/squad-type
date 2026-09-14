import { NextResponse } from "next/server";
import { DB_SCHEMA, prisma } from "@/lib/prisma";

/**
 * Sonda de saúde: diz se o ambiente está configurado e se o banco responde.
 *
 * Existe porque, sem ela, um 500 em produção é indistinguível de outro — falta
 * de variável, senha errada, schema inexistente e rede bloqueada dão todos a
 * mesma tela em branco, e o log fica atrás do painel do provedor.
 *
 * Nunca devolve VALOR de variável, só se está preenchida — e a mensagem de
 * erro do driver passa por uma redação, porque ela costuma repetir a URL de
 * conexão (com a senha) no texto.
 */
export const dynamic = "force-dynamic";

function redigir(mensagem: string): string {
  const url = process.env.DATABASE_URL ?? "";
  let limpo = url ? mensagem.split(url).join("<url>") : mensagem;
  // A senha também aparece isolada em algumas mensagens do pg.
  const senha = url.match(/:\/\/[^:]+:([^@]+)@/)?.[1];
  if (senha) limpo = limpo.split(decodeURIComponent(senha)).join("<senha>").split(senha).join("<senha>");
  return limpo.slice(0, 300);
}

export async function GET() {
  // Variáveis de SISTEMA da Vercel: sempre injetadas, independentemente do que
  // o projeto configurou. Se estas chegarem e as nossas não, o problema está no
  // vínculo das variáveis com este projeto — não na função nem no build.
  const vercel = {
    ambiente: process.env.VERCEL_ENV ?? "(fora da Vercel)",
    commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "?").slice(0, 7),
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? "?",
    projeto: process.env.VERCEL_PROJECT_ID ? "definido" : "ausente",
    regiao: process.env.VERCEL_REGION ?? "?",
    totalDeVariaveis: Object.keys(process.env).length,
    nossasChaves: Object.keys(process.env)
      .filter((k) => /^(DATABASE_URL|DIRECT_URL|DB_SCHEMA|NEXT_PUBLIC_|HUBSPOT_|CAL_)/.test(k))
      .sort(),
  };

  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    DIRECT_URL: Boolean(process.env.DIRECT_URL),
    DB_SCHEMA: process.env.DB_SCHEMA || "(ausente, usando padrão)",
    NEXT_PUBLIC_BRAND_NAME: Boolean(process.env.NEXT_PUBLIC_BRAND_NAME),
    NEXT_PUBLIC_CAL_LINK: Boolean(process.env.NEXT_PUBLIC_CAL_LINK),
    CAL_WEBHOOK_SECRET: Boolean(process.env.CAL_WEBHOOK_SECRET),
    HUBSPOT_ACCESS_TOKEN: Boolean(process.env.HUBSPOT_ACCESS_TOKEN),
  };

  let banco: { ok: boolean; schema: string; leads?: number; erro?: string };
  try {
    const leads = await prisma.lead.count();
    banco = { ok: true, schema: DB_SCHEMA, leads };
  } catch (err) {
    banco = {
      ok: false,
      schema: DB_SCHEMA,
      erro: redigir(err instanceof Error ? err.message : String(err)),
    };
  }

  return NextResponse.json({ vercel, env, banco }, { status: banco.ok ? 200 : 503 });
}
