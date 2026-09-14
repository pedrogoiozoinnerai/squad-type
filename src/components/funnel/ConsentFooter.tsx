import Link from "next/link";

export function ConsentFooter() {
  return (
    <p className="mt-2 text-center text-xs text-slate-500">
      Ao continuar, você concorda com a{" "}
      <Link href="/privacidade" className="underline hover:text-waz-40">
        Política de Privacidade
      </Link>{" "}
      e o{" "}
      <Link href="/termos" className="underline hover:text-waz-40">
        Termo de Consentimento
      </Link>
      .
    </p>
  );
}
