import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = {
  title: 'MIG FARM Admin Control Center',
  description: 'Production admin dashboard for MIG FARM.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
