import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'Open-source licences · Market Survivor' };

const PACKAGES: [string, string, string][] = [
  ['Next.js', 'MIT', 'https://github.com/vercel/next.js'],
  ['React, React DOM', 'MIT', 'https://github.com/facebook/react'],
  ['three.js', 'MIT', 'https://github.com/mrdoob/three.js'],
  ['React Three Fiber', 'MIT', 'https://github.com/pmndrs/react-three-fiber'],
  ['drei', 'MIT', 'https://github.com/pmndrs/drei'],
  ['Zustand', 'MIT', 'https://github.com/pmndrs/zustand'],
  ['Zod', 'MIT', 'https://github.com/colinhacks/zod'],
  ['Tailwind CSS', 'MIT', 'https://github.com/tailwindlabs/tailwindcss'],
  ['Bricolage Grotesque, IBM Plex Sans, IBM Plex Serif (Google Fonts)', 'SIL Open Font License 1.1', 'https://fonts.google.com/'],
];

export default function LicencesPage() {
  return (
    <LegalPage eyebrow="Market Survivor" title="Open-source licences">
      <h2>Charts</h2>
      <p>Price charts are drawn with TradingView Lightweight Charts™, used under the Apache License 2.0.</p>
      <pre className="notice">{'TradingView Lightweight Charts™\nCopyright (с) 2025 TradingView, Inc. https://www.tradingview.com/'}</pre>
      <p><a href="https://www.tradingview.com/" rel="noopener noreferrer" target="_blank">tradingview.com</a> · <a href="https://www.apache.org/licenses/LICENSE-2.0" rel="noopener noreferrer" target="_blank">Apache License 2.0</a></p>

      <h2>Other components</h2>
      <table>
        <thead><tr><th>Component</th><th>Licence</th></tr></thead>
        <tbody>
          {PACKAGES.map(([name, licence, url]) => (
            <tr key={name}><td><a href={url} rel="noopener noreferrer" target="_blank">{name}</a></td><td>{licence}</td></tr>
          ))}
        </tbody>
      </table>

      <h2>Game art</h2>
      <p>The backdrops, desk icons and mode art are original renders made with Blender scripts kept in the game&rsquo;s source repository.</p>
    </LegalPage>
  );
}
