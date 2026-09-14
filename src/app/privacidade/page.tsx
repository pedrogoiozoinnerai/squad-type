import { BRAND_NAME } from "@/lib/funnel";

export const metadata = { title: `Política de Privacidade — ${BRAND_NAME}` };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-slate-700">
      <h1 className="text-2xl font-bold text-slate-900">Política de Privacidade</h1>
      <p className="mt-4 text-sm text-amber-700">
        Conteúdo placeholder — substitua pelo texto revisado pelo jurídico da{" "}
        {BRAND_NAME} antes de publicar em produção (LGPD, Lei nº 13.709/2018).
      </p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-slate-600">
        <p>
          Coletamos os dados fornecidos neste formulário (nome, WhatsApp, e-mail,
          empresa, segmento, cargo e faturamento) para entrar em contato, avaliar o
          seu perfil e agendar uma reunião com o time da {BRAND_NAME}.
        </p>
        <p>
          Também registramos dados técnicos (endereço IP, navegador, origem de
          acesso e parâmetros de campanha) para fins de atribuição de marketing.
        </p>
        <p>
          Você pode solicitar a exclusão ou correção dos seus dados a qualquer
          momento entrando em contato com nosso time.
        </p>
      </div>
    </main>
  );
}
