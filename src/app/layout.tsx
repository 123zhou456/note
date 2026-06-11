import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { ApiInterceptor } from "@/components/api-interceptor";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "日记便签",
  description: "一款支持Markdown语法的移动端日记便签应用",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "日记便签",
    statusBarStyle: "default",
  },
  icons: [
    { rel: "icon", url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
    { rel: "apple-touch-icon", url: "/icon-192.svg", sizes: "192x192" },
  ],
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "日记便签",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground h-screen overflow-hidden`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ApiInterceptor />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
