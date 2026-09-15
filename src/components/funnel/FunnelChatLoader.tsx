"use client";

import dynamic from "next/dynamic";

const FunnelChat = dynamic(
  () => import("./FunnelChat").then((m) => m.FunnelChat),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-waz-50" />
      </div>
    ),
  }
);

export function FunnelChatLoader() {
  return <FunnelChat />;
}
