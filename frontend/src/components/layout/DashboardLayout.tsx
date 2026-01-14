'use client';

import React, { useState, useEffect } from 'react';
import Sidebar, { SidebarContent } from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { X, Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useUserRole } from '@/hooks/useUserRole';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { role, loading } = useUserRole();

  useEffect(() => {
    if (!loading && role === 'receptionist') {
      const restrictedPaths = [
        '/units',
        '/reports',
        '/accounting/chart-of-accounts',
        '/settings',
        '/admin'
      ];

      const isRestricted = restrictedPaths.some(path => pathname.startsWith(path));
      
      if (isRestricted) {
        router.replace('/'); // Redirect to dashboard
      }
    }
  }, [pathname, role, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 transition-opacity backdrop-blur-sm" 
            onClick={() => setSidebarOpen(false)}
          />
          
          {/* Drawer */}
          <aside className="fixed inset-y-0 right-0 w-72 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col z-50 animate-in slide-in-from-right">
             <div className="absolute top-4 left-4 z-50">
               <button 
                 onClick={() => setSidebarOpen(false)}
                 className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
               >
                 <X size={20} />
               </button>
             </div>
             <SidebarContent onNavigate={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 lg:mr-64 transition-all duration-300 w-full">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
