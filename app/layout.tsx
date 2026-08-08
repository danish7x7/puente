import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Puente — your first steps with AI",
  description:
    "Tell us about yourself in plain words, and get three tiny things you can try with AI today.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-ink">
        {children}
      </body>
    </html>
  );
}
