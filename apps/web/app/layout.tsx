import "./globals.css";
import { Manrope, Space_Grotesk } from "next/font/google";
import Navbar from "../components/Navbar";

const manrope = Manrope({ subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

export const metadata = {
  title: "TaskFlow",
  description: "TaskFlow AI"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <body className={manrope.className}>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
