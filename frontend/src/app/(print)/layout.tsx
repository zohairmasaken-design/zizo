import React from 'react';
import '@/app/globals.css';

export const metadata = {
  title: 'طباعة المستند',
};

export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="bg-white text-black min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
