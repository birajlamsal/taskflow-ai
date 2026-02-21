import "./globals.css";
import { Sora } from "next/font/google";
import Navbar from "../components/Navbar";

const sora = Sora({ subsets: ["latin"] });

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
    <html lang="en">
      <body className={sora.className}>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
