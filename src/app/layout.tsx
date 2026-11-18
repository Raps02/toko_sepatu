import type { Metadata } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import { ArcLinks } from '@/components/ui/ArcLinks';
import { SITE } from '@/lib/site';
import '@/components/arc/foundation.css';
import '@/components/arc/theme.css';
import './globals.css';

const body = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

const display = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: `${SITE.name} | ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${body.variable} ${display.variable}`}>
      <body className="min-h-screen bg-pavement font-sans text-asphalt antialiased">
        <ArcLinks>{children}</ArcLinks>
      </body>
    </html>
  );
}
