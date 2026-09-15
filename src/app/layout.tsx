import type { Metadata, Viewport } from "next";
import { Fustat } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const fustat = Fustat({
  variable: "--font-fustat",
  subsets: ["latin"],
});

const brandName = process.env.NEXT_PUBLIC_BRAND_NAME || "Squad.com";

export const metadata: Metadata = {
  title: `Diagnóstico ${brandName}`,
  description: "Descubra como aplicar IA no seu negócio com o time da " + brandName,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Deixa a página desenhar sob o notch e a barra inferior do iPhone — sem isto,
  // `env(safe-area-inset-*)` devolve sempre 0 e o respiro que damos no topo e no
  // rodapé simplesmente não aparece no aparelho.
  viewportFit: "cover",
  // Quando o teclado abre, encolhe a *layout viewport* em vez de só deslizar a
  // visual: é o que mantém o campo de resposta acima do teclado no Android, já
  // que a altura do chat passa a ser a altura realmente livre (100dvh).
  interactiveWidget: "resizes-content",
  themeColor: "#26a659",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

  return (
    <html lang="pt-BR" className={`${fustat.variable} h-full antialiased`}>
      <body className="flex min-h-dvh flex-col bg-background text-foreground">
        {pixelId && (
          <Script id="fb-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${pixelId}');
              fbq('track', 'PageView');
            `}
          </Script>
        )}
        {children}
      </body>
    </html>
  );
}
