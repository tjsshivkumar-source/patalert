import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PatAlert',
  description: 'Scan your design against USPTO patents before you ship.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
