import { SidebarNav } from '@/components/SidebarNav';
import AuthGuard from '@/components/AuthGuard';
import { RoleGuard } from '@/components/RoleGuard';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <SidebarNav />
        <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
          <RoleGuard>{children}</RoleGuard>
        </main>
      </div>
    </AuthGuard>
  );
}
