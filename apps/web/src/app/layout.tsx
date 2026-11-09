import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

// Supplies --font-sans, which tailwind.config.ts puts at the head of the sans stack.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ToastProvider } from '@/components/ui/Toast';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://doxera.in'),
  title: {
    default: 'Doxera – Enterprise PDF Intelligence Platform',
    template: '%s | Doxera',
  },
  description:
    'Convert, compress, edit and organize PDFs. Explore OCR, document questions, summaries and invoice extraction in one workspace.',
  keywords: [
    'PDF tools',
    'Merge PDF',
    'Compress PDF',
    'OCR PDF',
    'AI PDF Assistant',
    'Chat with PDF',
    'Invoice Extractor',
    'Contract Review AI',
    'Enterprise PDF SaaS',
  ],
  authors: [{ name: 'Doxera Architecture Team' }],
  creator: 'Doxera',
  publisher: 'Doxera',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://doxera.in',
    siteName: 'Doxera',
    title: 'Doxera – Enterprise PDF Intelligence & Conversion Platform',
    description:
      'PDF conversion, compression, editing, OCR and document analysis in one workspace.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Doxera Enterprise Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Doxera – Enterprise PDF Intelligence',
    description:
      'PDF processing, OCR and AI document analysis in one workspace.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Doxera',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'All',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description:
      'PDF processing with document questions, conversion, compression and editing tools.',
  };

  return (
    <html lang="en" suppressHydrationWarning className={`scroll-smooth ${inter.variable}`}>
      <head>
        {/* Applies the stored theme before first paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen flex flex-col font-sans bg-[var(--background)] text-[var(--foreground)] selection:bg-brand-600 selection:text-white">
        <ToastProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
