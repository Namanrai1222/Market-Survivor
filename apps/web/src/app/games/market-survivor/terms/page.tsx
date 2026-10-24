import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Todo } from '@/components/legal/LegalPage';
import { TERMS_VERSION } from '@/lib/modes';

export const metadata: Metadata = { title: 'Terms of Use · Market Survivor' };

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Market Survivor" title="Terms of Use" updated={TERMS_VERSION} draft>
      <h2>1. Who runs this game</h2>
      <p>Market Survivor is operated by <Todo>legal name of the operator</Todo>, <Todo>registered address</Todo> (&ldquo;we&rdquo;). By playing you agree to these terms.</p>

      <h2>2. Who can play</h2>
      <p>You must be 18 or older. We ask you to confirm this before you play, and we record that confirmation with the date and the version of these terms.</p>

      <h2>3. Virtual coins only</h2>
      <p>The game uses virtual coins that have no money value. You cannot buy coins, sell them, transfer them to anyone, exchange them for money or anything else, or win prizes. Nothing in the game is a stake, a wager or a deposit. Market Survivor is an online social game played for recreation and learning.</p>

      <h2>4. Fictional markets, not advice</h2>
      <ul>
        <li>Every company, index and price in the game is fictional and simulated. The game is not affiliated with, endorsed by or connected to any stock exchange, index provider or listed company.</li>
        <li>Time Machine replays are fictional scenarios shaped like past market episodes. They do not use real historical prices.</li>
        <li>Nothing in the game is investment advice, a recommendation or research. We are not registered with SEBI as an investment adviser or research analyst. Do not make real investment decisions based on the game.</li>
      </ul>

      <h2>5. Fair use of the game</h2>
      <p>Do not scrape or automate the game, attack or overload it, exploit bugs to change results, or try to reach other players&rsquo; data. We may suspend access that breaks these rules.</p>

      <h2>6. Your data</h2>
      <p>How we handle your data is explained in the <Link href="/games/market-survivor/privacy">Privacy Notice</Link>. You can delete all of it at any time with &ldquo;Delete my data&rdquo; at the bottom of the game pages.</p>

      <h2>7. Changes and availability</h2>
      <p>We may change the game, reset game worlds or update these terms. If the terms change, we will ask you to accept the new version before you play again. The game is provided as it is, without a promise that it will always be available.</p>

      <h2>8. Ownership</h2>
      <p>The game&rsquo;s software, art and text belong to us, except open-source components listed on the <Link href="/games/market-survivor/licences">licences page</Link>, which are used under their own licences.</p>

      <h2>9. Complaints</h2>
      <p>Send complaints and requests through the <Link href="/games/market-survivor/contact">contact form</Link>. Our grievance officer is <Todo>name and email of the grievance officer</Todo>. <Todo>response time the operator commits to</Todo>.</p>

      <h2>10. Law and courts</h2>
      <p>These terms are governed by the laws of India. Courts at <Todo>city</Todo> have jurisdiction.</p>
    </LegalPage>
  );
}
