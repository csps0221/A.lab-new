import './globals.css';

export const metadata = {
  title: 'A.lab | 解題實驗室',
  description: 'Science Lab Solution Platform',
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#030616' };

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant" data-theme="midnight_red">
      <body>{children}</body>
    </html>
  );
}
