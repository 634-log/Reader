import './globals.css';
import type { Metadata } from 'next';
import { Inter, Noto_Serif_JP, Noto_Sans_JP, Shippori_Mincho_B1 } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });
const notoSerifJP = Noto_Serif_JP({ 
  subsets: ['latin'], 
  weight: ['400', '700'],
  variable: '--font-noto-serif-jp' 
});
const notoSansJP = Noto_Sans_JP({ 
  subsets: ['latin'], 
  weight: ['400', '700'],
  variable: '--font-noto-sans-jp' 
});
const shipporiMincho = Shippori_Mincho_B1({ 
  subsets: ['latin'], 
  weight: ['400'],
  variable: '--font-shippori-mincho' 
});

export const metadata: Metadata = {
  title: 'readbeat - 新しい読書体験',
  description: 'パブリックドメインの名作を、新しい読書体験で楽しもう',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={`${inter.className} ${notoSerifJP.variable} ${notoSansJP.variable} ${shipporiMincho.variable}`}>
        {children}
      </body>
    </html>
  );
}