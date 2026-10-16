import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'PDFForge AI – Enterprise PDF Intelligence Platform',
  description: 'Scalable cloud-based PDF processing ecosystem with AI document intelligence, OCR, automated conversion, and enterprise compliance.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-screen flex flex-col bg-[#fbfbfd] text-[#1d1d1f] selection:bg-blue-600 selection:text-white">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
