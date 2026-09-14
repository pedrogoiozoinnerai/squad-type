import { BRAND_NAME } from "@/lib/funnel";

export const metadata = { title: `Termo de Consentimento — ${BRAND_NAME}` };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-slate-700">
      <h1 className="text-2xl font-bold text-slate-900">Termo de Consentimento</h1>
      <p className="mt-4 text-sm text-amber-700">
        Conteúdo placeholder — substitua pelo texto revisado pelo jurídico da{" "}
        {BRAND_NAME} antes de publicar em produção.
      </p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-slate-600">
        <p>
          Ao preencher este formulário, você autoriza a {BRAND_NAME} a entrar em
          contato via WhatsApp, e-mail ou telefone para apresentar sua solução e
          agendar uma reunião comercial.
        </p>
        <p>
          Você pode revogar este consentimento a qualquer momento.
        </p>
      </div>
    </main>
  );
}
