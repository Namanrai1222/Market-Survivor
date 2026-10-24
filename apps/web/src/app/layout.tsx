import type { Metadata } from 'next';
import { Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Serif } from 'next/font/google';
import './globals.css';
import { Interactions } from '@/components/Interactions';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-sans', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-mono', display: 'swap' });
const serif = IBM_Plex_Serif({ subsets: ['latin'], weight: ['400'], style: ['italic'], variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  title: 'Market Survivor',
  description: 'A connected-world market learning game.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body>
        {children}
        <Interactions />
      </body>
    </html>
  );
}
