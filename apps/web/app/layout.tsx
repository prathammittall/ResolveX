import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "../lib/auth-context";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "ResolveX — Intelligent Engineering Operations in One Workspace",
  description: "Intelligent incident response, monitoring, and engineering telemetry.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint. Defaults to white/light mode. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(location.pathname.indexOf('/dashboard')===0){var t=localStorage.getItem('rx-theme');document.documentElement.dataset.theme=(t==='dark'?'dark':'light')}}catch(e){}`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
