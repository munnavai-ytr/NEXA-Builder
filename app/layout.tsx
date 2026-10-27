import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'NEXA Builder — In-Browser BYOK AI App Studio',
  description: 'Premium mobile-first BYOK AI app builder running entirely in the browser with virtual file system, live preview, multi-provider AI streaming, and CodeMirror editor.',
  openGraph: {
    title: 'NEXA Builder — In-Browser BYOK AI App Studio',
    description: 'Premium mobile-first BYOK AI app builder running entirely in the browser with virtual file system, live preview, multi-provider AI streaming, and CodeMirror editor.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NEXA Builder — In-Browser BYOK AI App Studio',
    description: 'Premium mobile-first BYOK AI app builder running entirely in the browser with virtual file system, live preview, multi-provider AI streaming, and CodeMirror editor.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
