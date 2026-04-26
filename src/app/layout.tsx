import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WORLDSUN MEDDIC Pipeline',
  description: 'MEDDPICC Qualification & Funnel for WORLDSUN 沃勝聯合家族辦公室',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: '腦圖',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0a0a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className="font-sans">{children}</body>
    </html>
  );
}
