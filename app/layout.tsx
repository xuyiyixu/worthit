import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorthIt — Know before you go",
  description: "See what an event may cost, what it may give, and when it is most worth showing up."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
