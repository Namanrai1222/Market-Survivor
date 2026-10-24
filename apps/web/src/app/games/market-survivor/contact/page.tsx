import type { Metadata } from 'next';
import { GrievanceForm } from '@/components/legal/GrievanceForm';
import { LegalPage, Todo } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'Contact & complaints · Market Survivor' };

export default function ContactPage() {
  return (
    <LegalPage eyebrow="Market Survivor" title="Contact and complaints">
      <p>Report a problem, ask about your data or make a complaint. Every message gets a reference number.</p>
      <p>Grievance officer: <Todo>name, email and postal address</Todo></p>
      <GrievanceForm />
      <p className="muted">To delete all your data straight away, use &ldquo;Delete my data&rdquo; below.</p>
    </LegalPage>
  );
}
