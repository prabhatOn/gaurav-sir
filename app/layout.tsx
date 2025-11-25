import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { MarketProvider } from '@/components/market/market-context'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Options Trading Dashboard',
  description: 'Professional trading dashboard for options trading on BSE and NSE',
    generator: 'v0.app'
}

// Next.js now expects viewport config to be exported separately via `viewport` export
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true} className={`font-sans antialiased bg-gray-50`}>
        <MarketProvider>
          {children}
        </MarketProvider>
        <Analytics />
      </body>
    </html>
  )
}
