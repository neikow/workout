import type { Metadata, Viewport } from "next";
import { SettingsProvider, ThemeApplier } from "@/lib/settings";
import { AuthProvider } from "@/lib/auth-provider";
import "./globals.css";

const THEME_SCRIPT = `try{var s=localStorage.getItem('workout:settings-v1');if(s){var t=JSON.parse(s).theme;if(t&&t!=='system')document.documentElement.setAttribute('data-theme',t)}}catch(e){}`;

export const metadata: Metadata = {
  title: "Workout",
  description: "Mobile-first gym workout tracker",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4ff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d16" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <AuthProvider>
          <SettingsProvider>
            <ThemeApplier />
            {children}
          </SettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
