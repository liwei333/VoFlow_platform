import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VoFlow - 智能口播平台",
  description: "AI驱动的智能口播视频生成平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
