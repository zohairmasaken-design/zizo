'use client';

import React from 'react';
import { Printer } from 'lucide-react';

export default function PrintActions() {
  return (
    <div className="fixed bottom-8 left-8 print:hidden">
      <button 
        onClick={() => window.print()} 
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-lg flex items-center gap-2 transition-transform hover:scale-105"
      >
        <Printer size={20} />
        طباعة / حفظ PDF
      </button>
    </div>
  );
}
