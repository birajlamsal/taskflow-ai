import "./globals.css";
import { Manrope, Space_Grotesk } from "next/font/google";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const manrope = Manrope({ subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

export const metadata = {
  title: "TaskFlow",
  description: "TaskFlow AI"
};

import { ThemeProvider } from "../components/ThemeProvider";
import AICopilot from "../components/AICopilot";

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={spaceGrotesk.variable} suppressHydrationWarning>
      <body className={`${manrope.className} mesh-bg relative overflow-x-hidden min-h-screen`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <div className="fixed inset-0 pointer-events-none z-0">
            <div className="absolute inset-0 glow-overlay transition-opacity duration-1000" id="mouse-glow" />
          </div>
          <Navbar />
          <AICopilot />
          <main className="relative z-10 pt-32">
            {children}
          </main>
          <Footer />
        </ThemeProvider>
        <script dangerouslySetInnerHTML={{
          __html: `
          window.addEventListener('mousemove', (e) => {
            const glow = document.getElementById('mouse-glow');
            if (glow) {
              glow.style.setProperty('--x', e.clientX + 'px');
              glow.style.setProperty('--y', e.clientY + 'px');
            }
          });
        `}} />
      </body>
    </html>
  );
}
