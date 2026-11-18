import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Maploom — turn your neighborhood into a one-of-a-kind map',
  description: 'Enter an address and watch your streets, parks and favourite places become illustrated artwork — for a wall, a gift, or a play mat.',
  robots: { index: false }, // working title / pre-launch
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#fff8ea' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
