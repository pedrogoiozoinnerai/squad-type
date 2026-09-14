import type { Metadata } from "next";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

  return (
    <html lang="pt-BR" className={`${fustat.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
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
