import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nonprofit Compare — IRS Form 990 Data Explorer",
  description:
    "Search, analyze, and compare US nonprofit financial data from IRS Form 990 filings. Evaluate program efficiency, growth, and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Header />
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
        <footer className="border-t py-6 mt-12">
          <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
            <p>
              Data sourced from IRS Form 990 public filings. For informational purposes only.
            </p>
            <p className="mt-1">
              Built with{" "}
              <a href="https://nextjs.org" className="underline" target="_blank" rel="noreferrer">
                Next.js
              </a>
              {" "}·{" "}
              <a href="https://propublica.org" className="underline" target="_blank" rel="noreferrer">
                ProPublica Nonprofit Explorer
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
