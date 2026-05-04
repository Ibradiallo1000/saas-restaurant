import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/contexts/theme-context';
import { FirebaseClientProvider } from '@/firebase/client-provider';

export const metadata: Metadata = {
  title: 'GastronomeAI - SaaS Foundation',
  description: 'Scalable multi-tenant architecture for modern hospitality',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.classList.toggle('dark',localStorage.getItem('saas-theme')==='dark')}catch(e){}",
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&family=Playfair+Display:wght@700;900&display=swap"
          rel="stylesheet"
        />
      </head>

      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <ThemeProvider>{children}</ThemeProvider>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
