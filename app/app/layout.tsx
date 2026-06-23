import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { AntdProvider } from '@/components/AntdProvider';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'iQ Quality',
  description: 'Allegion SAT iQ Quality Portal',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={montserrat.variable} style={{ height: '100%' }}>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>
      </head>
      <body style={{ height: '100%', fontFamily: 'var(--font-montserrat), sans-serif' }}>
        <AntdRegistry><AntdProvider>{children}</AntdProvider></AntdRegistry>
      </body>
    </html>
  );
}
