import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://pdfforge.ai'),
  title: {
    default: 'PDFForge AI – Enterprise PDF Intelligence Platform',
    template: '%s | PDFForge AI',
  },
  description:
    'Scalable enterprise cloud and air-gapped PDF processing platform with 24+ tools, OCR, RAG document chat, invoice extraction, and DoD-grade compliance.',
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
  authors: [{ name: 'PDFForge AI Architecture Team' }],
  creator: 'PDFForge AI',
  publisher: 'PDFForge AI Inc.',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://pdfforge.ai',
    siteName: 'PDFForge AI',
    title: 'PDFForge AI – Enterprise PDF Intelligence & Conversion Platform',
    description:
      'Enterprise-grade PDF ecosystem with AI RAG document chat, OCR, compression, digital signatures, and 100% private on-premise LLM inference.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PDFForge AI Enterprise Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PDFForge AI – Enterprise PDF Intelligence',
    description:
      'Enterprise-grade PDF processing with 24+ tools, OCR, and private AI Document Intelligence.',
    creator: '@pdfforge_ai',
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
    name: 'PDFForge AI',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'All',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    description:
      'Enterprise cloud & on-premise PDF processing platform with AI document chat, automated conversion, compression, and enterprise compliance.',
  };

  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-[#fbfbfd] text-[#1d1d1f] selection:bg-blue-600 selection:text-white">
        <ToastProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
