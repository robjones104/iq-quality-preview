import { SidebarNav } from '@/components/SidebarNav';
import AuthGuard from '@/components/AuthGuard';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <SidebarNav />
        <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>{children}</main>
      </div>
    </AuthGuard>
  );
}
