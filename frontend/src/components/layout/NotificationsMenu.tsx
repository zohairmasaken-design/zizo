'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Clock, CheckCircle, AlertCircle, Home, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface SystemEvent {
  id: string;
  event_type: string;
  message: string;
  created_at: string;
  read?: boolean;
}

export default function NotificationsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();

    // Setup real-time subscription
    const subscription = supabase
      .channel('public:system_events')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_events' }, (payload) => {
        const newEvent = payload.new as SystemEvent;
        setNotifications(prev => [newEvent, ...prev]);
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();

    // Close menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('system_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) {
      setNotifications(data);
      // Assuming for now we just show recent ones, but unread logic could be more complex
      // For this implementation, we'll just assume top 5 are what we care about for the badge
      // In a real app, we'd have a 'read' column
      setUnreadCount(data.length > 0 ? 3 : 0); // Mocking unread count for visual feedback initially
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'check_in': return <CheckCircle size={16} className="text-green-500" />;
      case 'check_out': return <AlertCircle size={16} className="text-amber-500" />;
      case 'new_booking': return <Bell size={16} className="text-blue-500" />;
      case 'room_needs_cleaning': return <Home size={16} className="text-purple-500" />;
      case 'check_in_reminder': return <Clock size={16} className="text-red-500" />;
      case 'check_out_reminder': return <Clock size={16} className="text-orange-500" />;
      default: return <Bell size={16} className="text-gray-500" />;
    }
  };

  const getEventColor = (type: string) => {
     if (type === 'check_out_reminder') return 'bg-amber-50';
     if (type === 'check_in_reminder') return 'bg-red-50';
     if (type === 'new_booking') return 'bg-blue-50';
     return 'bg-gray-50';
  };

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors focus:outline-none"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-pulse"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 origin-top-left animate-in fade-in zoom-in-95 duration-200">
          <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
            <h3 className="font-bold text-gray-900 text-sm">التنبيهات</h3>
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full font-medium">
              {notifications.length} جديد
            </span>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell size={32} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">لا توجد تنبيهات جديدة</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {notifications.map((notification) => (
                  <div key={notification.id} className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${getEventColor(notification.event_type)}`}>
                    <div className="flex gap-3 items-start">
                      <div className="mt-0.5 bg-white p-1.5 rounded-lg shadow-sm border border-gray-100 shrink-0">
                        {getEventIcon(notification.event_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 leading-snug mb-1 font-medium">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock size={10} />
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ar })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
            <Link 
              href="/notifications" 
              onClick={() => setIsOpen(false)}
              className="text-sm text-blue-600 font-bold hover:text-blue-700 hover:underline transition-all block w-full"
            >
              عرض كافة التنبيهات
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
