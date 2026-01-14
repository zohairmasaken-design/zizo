'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  CalendarDays, 
  BedDouble, 
  Users, 
  FileText, 
  Settings, 
  LogOut,
  CreditCard,
  PieChart,
  List,
  BookOpen,
  ScrollText,
  UserCog,
  Wrench,
  Brush,
  Bell,
  Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserRole } from '@/hooks/useUserRole';

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  href: string;
  onClick?: () => void;
}

const SidebarItem = ({ icon: Icon, label, href, onClick }: SidebarItemProps) => {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link 
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
        "hover:bg-gray-100 text-gray-700",
        isActive && "bg-blue-50 text-blue-600 font-medium"
      )}
    >
      <Icon size={20} />
      <span>{label}</span>
    </Link>
  );
};

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { role, loading } = useUserRole();
  const isReceptionist = role === 'receptionist';

  // Helper to show/hide items based on role
  // If role is loading, we default to showing nothing or safe items to prevent flickering of forbidden items?
  // Or we show skeleton? For now, let's just render. 
  // If loading, role is null. isReceptionist is false. So we might show items briefly?
  // Better to check if loading.
  
  if (loading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-6"></div>
        <div className="space-y-4">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold text-blue-600">مساكن<span className="text-gray-900">App</span></h1>
        <p className="text-xs text-gray-500 mt-1">نظام إدارة الفنادق المتكامل</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="mb-4">
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">العمليات</p>
            <SidebarItem icon={LayoutDashboard} label="لوحة التحكم" href="/" onClick={onNavigate} />
            <SidebarItem icon={CalendarDays} label="حجز جديد" href="/bookings" onClick={onNavigate} />
            <SidebarItem icon={List} label="سجل الحجوزات" href="/bookings-list" onClick={onNavigate} />
            
            {!isReceptionist && (
              <SidebarItem icon={BedDouble} label="الوحدات" href="/units" onClick={onNavigate} />
            )}
            
            <SidebarItem icon={Wrench} label="صيانة الوحدات" href="/maintenance" onClick={onNavigate} />
            <SidebarItem icon={Brush} label="تنظيف الوحدات" href="/cleaning" onClick={onNavigate} />
            <SidebarItem icon={Bell} label="التنبيهات" href="/notifications" onClick={onNavigate} />
            <SidebarItem icon={Users} label="العملاء والضيوف" href="/customers" onClick={onNavigate} />
        </div>

        <div className="mb-4">
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">المالية</p>
            <SidebarItem icon={FileText} label="الفواتير" href="/invoices" onClick={onNavigate} />
            <SidebarItem icon={CreditCard} label="المدفوعات" href="/payments" onClick={onNavigate} />
            
            {!isReceptionist && (
              <SidebarItem icon={PieChart} label="التقارير" href="/reports" onClick={onNavigate} />
            )}
        </div>

        <div className="mb-4">
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">المحاسبة</p>
            {!isReceptionist && (
              <SidebarItem icon={BookOpen} label="دليل الحسابات" href="/accounting/chart-of-accounts" onClick={onNavigate} />
            )}
            <SidebarItem icon={ScrollText} label="كشف حساب" href="/accounting/statement" onClick={onNavigate} />
            <SidebarItem icon={Building2} label="تسوية المنصات" href="/accounting/platforms" onClick={onNavigate} />
        </div>

        <div>
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">النظام</p>
            {role === 'admin' && (
              <SidebarItem icon={UserCog} label="المستخدمين والصلاحيات" href="/admin/users" onClick={onNavigate} />
            )}
            
            {!isReceptionist && (
              <SidebarItem icon={Settings} label="الإعدادات" href="/settings" onClick={onNavigate} />
            )}
        </div>
      </nav>

      <div className="p-4 border-t">
        <button className="flex items-center gap-3 px-3 py-2 w-full text-right text-red-600 hover:bg-red-50 rounded-md transition-colors">
          <LogOut size={20} />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </>
  );
}

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex w-64 border-l bg-white h-screen flex-col fixed right-0 top-0 z-50">
      <SidebarContent />
    </aside>
  );
}
