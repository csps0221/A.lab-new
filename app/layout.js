import './globals.css';

export const metadata = { title: 'A.lab | 解題實驗室', description: 'Science Lab Solution Platform' };
export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant" data-theme="graphite_gray">
      <body>{children}</body>
    </html>
  );
}
