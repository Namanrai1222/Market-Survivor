import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Todo } from '@/components/legal/LegalPage';
import { TERMS_VERSION } from '@/lib/modes';

export const metadata: Metadata = { title: 'Privacy Notice · Market Survivor' };

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Market Survivor" title="Privacy Notice" updated={TERMS_VERSION} draft>
      <p>This notice explains what personal data Market Survivor processes, why, and how you can control it, as required by the Digital Personal Data Protection Act, 2023. The data fiduciary is <Todo>legal name and address of the operator</Todo>.</p>

      <h2>What we collect</h2>
      <table>
        <thead><tr><th>Data</th><th>Why</th></tr></thead>
        <tbody>
          <tr><td>A random player ID stored in one cookie (<code>ms_pid</code>)</td><td>To keep your games tied to your browser. It is strictly necessary for the game to work. We do not ask for your name, phone number or email to play.</td></tr>
          <tr><td>Your games: careers, trades, story choices, Daily and Time Machine results, quiz answers</td><td>To run the game and save your progress.</td></tr>
          <tr><td>Your consent record: that you confirmed you are 18+, accepted these terms, the version and the time</td><td>To show we asked before processing your data.</td></tr>
          <tr><td>Messages you send through the contact form, and an email address if you choose to add one</td><td>To answer your complaint or request.</td></tr>
          <tr><td>Basic technical logs kept by our hosting provider</td><td>To keep the service secure and working. <Todo>hosting provider and log retention</Todo></td></tr>
        </tbody>
      </table>
      <p>Your browser also stores a few preferences locally (whether you have seen the tour, the 3D on/off switch, which briefings you have read). They never leave your device.</p>

      <h2>Children</h2>
      <p>This version of the game is for people aged 18 and over. We do not knowingly process data of anyone under 18, and we do not track, profile or show targeted advertising to anyone.</p>

      <h2>Sharing</h2>
      <p>We do not sell your data. We share it only with the service providers that host the game, under contract, and with authorities when the law requires it. <Todo>list of processors</Todo></p>

      <h2>Where it is stored and for how long</h2>
      <p>Game data is stored on servers in India. <Todo>confirm hosting region</Todo> We keep your games while you play and delete inactive game data after three years, after notifying you where we can. <Todo>automatic deletion job before launch</Todo> Complaints are kept for as long as needed to resolve them and meet legal duties.</p>

      <h2>Your rights</h2>
      <ul>
        <li><b>Erase everything:</b> &ldquo;Delete my data&rdquo; at the bottom of the game pages removes every career, result, quiz score and consent record at once.</li>
        <li><b>Withdraw consent:</b> deleting your data withdraws it; the game will ask again before you play.</li>
        <li><b>Access and correction:</b> ask through the <Link href="/games/market-survivor/contact">contact form</Link>.</li>
        <li><b>Nominate</b> someone to exercise your rights if you cannot.</li>
        <li><b>Complain</b> to our grievance officer, <Todo>name and email</Todo>, and if you are not satisfied, to the Data Protection Board of India.</li>
      </ul>

      <h2>Security</h2>
      <p>Hidden game data is encrypted at rest, other players cannot reach your careers, and we will notify you and the Data Protection Board if a breach affects your data.</p>
    </LegalPage>
  );
}
