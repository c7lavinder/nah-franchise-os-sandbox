import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth/AuthContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "NAH FranDev — Franchise Sales OS",
  description:
    "AI-powered franchise sales platform. Scout helps reps manage leads, stay accountable, and close franchise deals faster.",
};

/** Root layout — wraps the entire application with auth provider + ambient background */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Signika:wght@300;400;500;600;700&family=Roboto:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg-primary text-text-primary font-sans antialiased min-h-screen">
        {/* Ambient glow background — fixed, behind everything */}
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div
            className="absolute rounded-full animate-drift"
            style={{
              width: 900, height: 900,
              background: "#e6f7fd",
              filter: "blur(120px)",
              opacity: 0.6,
              top: -200, left: -200,
            }}
          />
          <div
            className="absolute rounded-full animate-drift"
            style={{
              width: 750, height: 750,
              background: "#b3e4f7",
              filter: "blur(120px)",
              opacity: 0.6,
              top: "50%", right: -150,
              transform: "translateY(-50%)",
              animationDelay: "-10s",
            }}
          />
          <div
            className="absolute rounded-full animate-drift"
            style={{
              width: 680, height: 680,
              background: "#f4f7f8",
              filter: "blur(120px)",
              opacity: 0.6,
              bottom: -150, left: "40%",
              animationDelay: "-20s",
            }}
          />
        </div>

        {/* App content — above ambient background */}
        <div className="relative z-[1]">
          <AuthProvider>{children}</AuthProvider>
        </div>
      </body>
    </html>
  );
}
