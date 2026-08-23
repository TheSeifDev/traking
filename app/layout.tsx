import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://trakeup.vercel.app"),
  title: {
    default: "TrackUp | Video intelligence for ClickUp teams",
    template: "%s | TrackUp",
  },
  description: "Private video sharing, viewer access, and honest playback analytics for ClickUp-connected teams.",
  applicationName: "TrackUp",
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
    shortcut: "/favicon.ico",
    apple: "/logo.webp",
  },
};

export const viewport: Viewport = {
  themeColor: "#070720",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${montserrat.variable} h-full antialiased`}
    >
      <body
        className="
          min-h-full
          flex
          flex-col
          font-sans
          bg-[#070720]
          text-white
        "
      >
        {children}
      </body>
    </html>
  );
}