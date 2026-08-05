import { SidebarNav } from '@/components/SidebarNav';
import AuthGuard from '@/components/AuthGuard';
import { RoleGuard } from '@/components/RoleGuard';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <SidebarNav />
        <main id="main-content" tabIndex={-1} style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
          <RoleGuard>{children}</RoleGuard>
        </main>
      </div>
    </AuthGuard>
  );
}
