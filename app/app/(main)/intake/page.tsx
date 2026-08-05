import { redirect } from 'next/navigation';

// The Intake home retired when the role merged into Branch (Rob 2026-08-05):
// the branch dashboard is the landing; only the report form lives on here.
export default function IntakePage() {
  redirect('/dashboard');
}
