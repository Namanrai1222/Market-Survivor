import type { Metadata } from 'next';
import { AcademyApp } from '@/components/academy/AcademyApp';
import { LegalPage } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'Academy · Market Survivor' };

export default function AcademyPage() {
  return (
    <LegalPage eyebrow="Market Survivor" title="Academy">
      <AcademyApp />
    </LegalPage>
  );
}
