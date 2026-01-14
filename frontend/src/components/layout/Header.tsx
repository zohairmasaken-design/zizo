import React from 'react';
import { Search, User, Menu } from 'lucide-react';
import NotificationsMenu from './NotificationsMenu';
import UserMenu from './UserMenu';

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4 lg:w-96">
        {onMenuClick && (
          <button 
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-md"
          >
            <Menu size={24} />
          </button>
        )}
        <div className="relative w-full hidden sm:block">
          <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="بحث عن حجز، ضيف، أو فاتورة..." 
            className="w-full pr-10 pl-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  );
}
