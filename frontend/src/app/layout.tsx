import type { Metadata } from "next";
import "../styles/globals.css";
import { calSemibold, geistMono, geistSans, inter, matter, robotoMono } from "../../public/fonts";
import { ToastProvider } from "@/components/ui/toast";
import Footer from "@/components/sections/Footer";
import ConditionalNavbar from "@/components/layout/ConditionalNavbar";
import { AuthProvider } from "@/contexts/AuthContext";
import { absoluteAsset, asset, SITE_URL } from "@/lib/asset";

export const metadata: Metadata = {
  title: {
    default: "Proofly - Blockchain-Based Document Verification Platform",
    template: "%s | Proofly",
  },
  description: "Proofly is a decentralized platform built on the Thebes Protocol for secure employment and document verification. Verify positions, certificates and official documents against a post-quantum Layer 1.",
  keywords: [
    "blockchain",
    "document verification",
    "Thebes",
    "Thebes Protocol",
    "Memphis passkey identity",
    "certificate verification",
    "degree authentication",
    "decentralized verification",
    "Web3",
    "document authentication",
    "blockchain certificates",
  ],
  authors: [{ name: "Proofly Team" }],
  creator: "Proofly",
  publisher: "Proofly",
  // Where this build is actually served from — the boundary, under the
  // frontend contract's own prefix. Every relative metadata URL resolves
  // against this, so it has to be the real one or the cards point at nothing.
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    title: "Proofly - Blockchain-Based Document Verification Platform",
    description: "Verify certificates, degrees, and official documents securely on the Thebes Protocol.",
    siteName: "Proofly",
    images: [
      {
        // Absolute: a link preview is fetched by someone else's server, which
        // has no origin to resolve a root-relative path against.
        url: absoluteAsset("/images/proofly-logo.png"),
        width: 1200,
        height: 630,
        alt: "Proofly - Blockchain Document Verification",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Proofly - Blockchain-Based Document Verification",
    description: "Verify certificates and documents securely on the Thebes Protocol",
    images: [absoluteAsset("/images/proofly-logo.png")],
    creator: "@proofly",
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
  icons: {
    icon: asset("/images/proofly-logo.png"),
    apple: asset("/images/proofly-logo.png"),
  },
  manifest: asset("/manifest.json"),
};

/**
 * Proofly is served from the chain under `/_/raw/<cid>/`, so the vendored
 * runtimes are addressed through the same prefix Next.js was built with.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${calSemibold.variable} ${matter.variable} ${inter.variable} ${robotoMono.variable} ${geistSans.variable} ${geistMono.variable} antialiased light`}
      >
        {/*
          Memphis, Thebes' identity layer. `memphis-connect.js` runs the passkey
          ceremony in a window at the Memphis origin and hands back a token
          minted for this origin only; `passkey.js` carries the Memphis
          transport, which is what lets a session renew silently instead of
          asking for a passkey several times a day.

          These are deliberately plain, blocking <script> tags rather than
          next/script. Under `output: "export"`, `strategy="beforeInteractive"`
          does not emit a real tag at all — it queues the URL for Next's client
          runtime to fetch after hydration has already started, so the first
          session restore runs against a `window.memphis` that does not exist
          yet and a signed-in visitor lands on the page signed out. A blocking
          tag at the top of the body is parsed and executed before any of
          Next's own scripts, which is exactly the ordering this needs.
        */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src={`${basePath}/memphis-connect.js`}></script>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src={`${basePath}/passkey.js`}></script>
        <AuthProvider>
          <ToastProvider>
            <ConditionalNavbar />
            {children}
            <Footer />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}