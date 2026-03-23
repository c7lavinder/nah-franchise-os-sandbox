import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth/AuthContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "New Again Houses — Franchise OS",
  description:
    "AI-powered franchise sales platform. Scout helps reps manage leads, stay accountable, and close franchise deals faster.",
};

/** Root layout — wraps the entire application with auth provider */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg-primary text-text-primary min-h-screen">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
