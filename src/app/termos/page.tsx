import { BRAND_NAME } from "@/lib/funnel";

export const metadata = { title: `Termo de Consentimento — ${BRAND_NAME}` };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-slate-700">
      <h1 className="text-2xl font-bold text-slate-900">Termo de Consentimento</h1>
      <p className="mt-4 text-sm text-amber-700">
        Conteúdo placeholder — substitua pelo texto revisado pelo jurídico da{" "}
        {BRAND_NAME} antes de publicar em produção.{" "}
        <strong>
          O parágrafo sobre gravação precisa ser revisado antes de a gravação ser
          ligada, não depois: é este aceite que cobre gravar a reunião.
        </strong>{" "}
        O prazo de guarda ainda está marcado como [DEFINIR] e precisa de um número.
      </p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-slate-600">
        <p>
          Ao preencher este formulário, você autoriza a {BRAND_NAME} a entrar em
          contato via WhatsApp, e-mail ou telefone para apresentar sua solução e
          agendar uma reunião comercial.
        </p>
        {/*
          O parágrafo que faltava.

          O aceite deste termo é o que autoriza gravar a reunião — não há um
          segundo aceite na porta da sala. Por isso ele precisa dizer, sem
          rodeio, as quatro coisas que a pessoa não tem como adivinhar: que é
          ÁUDIO E VÍDEO, que uma IA processa o conteúdo, que o time comercial
          inteiro assiste (e não só quem conduziu), e por quanto tempo fica.
          Sem essas quatro, o aceite existe e não cobre o que fazemos.
        */}
        <p>
          <strong className="text-slate-900">Gravação da reunião.</strong> As
          reuniões comerciais da {BRAND_NAME} são gravadas em áudio e vídeo. A
          gravação é transcrita e analisada por inteligência artificial para
          gerar resumo da conversa e avaliação do atendimento, e fica disponível
          para a equipe comercial da {BRAND_NAME} — não apenas para quem conduziu
          a reunião. O material é usado para acompanhamento do seu atendimento e
          para treinamento interno da equipe, e não é publicado nem
          compartilhado fora dela. A transcrição é processada por fornecedores
          contratados para essa finalidade, que podem estar fora do Brasil. As
          gravações são guardadas por [DEFINIR] e depois apagadas.
        </p>
        <p>
          Você pode revogar este consentimento a qualquer momento, e pode pedir
          acesso, correção ou exclusão dos seus dados — inclusive da gravação —
          pelos canais de contato da {BRAND_NAME}. Se preferir não ser gravado,
          avise antes da reunião para combinarmos outro formato.
        </p>
      </div>
    </main>
  );
}
