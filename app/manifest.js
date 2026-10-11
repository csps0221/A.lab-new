export default function manifest() {
  return {
    name: 'A.lab | 解題實驗室',
    short_name: 'A.lab',
    description: 'Science Lab Solution Platform',
    start_url: '/',
    display: 'standalone',
    background_color: '#030616',
    theme_color: '#030616',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
