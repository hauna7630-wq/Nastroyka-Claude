import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Teamly — корпоративная база знаний',
  description: 'Knowledge base, wiki and learning platform.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
