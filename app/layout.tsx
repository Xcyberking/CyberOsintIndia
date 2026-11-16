import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AppNavigation from '@/components/AppNavigation';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'CyberX OSINT | Open Source Intelligence Tools',
  description: 'Ethical OSINT tools for public-information research and authorized security work.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#2563eb' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang='en' className={inter.variable}>
      <body><AppNavigation /><div className='app-content'>{children}</div></body>
    </html>
  );
}
