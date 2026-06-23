import { SidebarNav } from '@/components/SidebarNav';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <SidebarNav />
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>{children}</main>
    </div>
  );
}
