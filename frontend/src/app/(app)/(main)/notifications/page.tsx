import React from 'react';
import { createClient } from '@/lib/supabase-server';
import { Bell, CalendarCheck, LogIn, LogOut, Brush, AlertTriangle, CheckCircle2, User, Home, CreditCard } from 'lucide-react';

const EVENT_LABELS: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  booking_created: { label: 'حجز جديد', icon: CalendarCheck, color: 'bg-blue-100 text-blue-700' },
  check_in: { label: 'تسجيل دخول', icon: LogIn, color: 'bg-green-100 text-green-700' },
  check_out: { label: 'تسجيل خروج', icon: LogOut, color: 'bg-gray-100 text-gray-700' },
  room_needs_cleaning: { label: 'الغرفة تحتاج تنظيف', icon: Brush, color: 'bg-amber-100 text-amber-700' },
  cleaning_done: { label: 'تم التنظيف', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700' },
  payment_settled: { label: 'سداد متبقي', icon: CreditCard, color: 'bg-purple-100 text-purple-700' },
  arrival_today: { label: 'وصول اليوم', icon: CalendarCheck, color: 'bg-sky-100 text-sky-700' },
  departure_today: { label: 'مغادرة اليوم', icon: CalendarCheck, color: 'bg-slate-100 text-slate-700' },
  staff_note: { label: 'ملاحظة على موظف', icon: AlertTriangle, color: 'bg-red-100 text-red-700' },
};

export const metadata = {
  title: 'تنبيهات النظام',
};

export default async function NotificationsPage() {
  const supabase = await createClient();

  const { data: events } = await supabase
    .from('system_events')
    .select('*, customer:customers(full_name), unit:units(unit_number), hotel:hotels(name)')
    .order('created_at', { ascending: false })
    .limit(100);

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const { data: arrivalsToday } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, status, customers(full_name), units(unit_number), hotels(name)')
    .eq('check_in', todayStr)
    .in('status', ['confirmed', 'pending_deposit']);

  const { data: departuresToday } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, status, customers(full_name), units(unit_number), hotels(name)')
    .eq('check_out', todayStr)
    .eq('status', 'checked_in');

  const syntheticEvents: any[] = [];

  (arrivalsToday || []).forEach((b: any) => {
    syntheticEvents.push({
      id: `arrival-${b.id}`,
      event_type: 'arrival_today',
      created_at: b.check_in,
      message: `اليوم هو موعد دخول ${b.customers?.full_name || ''} للحجز رقم ${b.id.slice(0, 8).toUpperCase()} في الغرفة ${b.units?.unit_number || ''} (${b.hotels?.name || ''})`,
      customer: b.customers,
      unit: b.units,
      hotel: b.hotels,
    });
  });

  (departuresToday || []).forEach((b: any) => {
    syntheticEvents.push({
      id: `departure-${b.id}`,
      event_type: 'departure_today',
      created_at: b.check_out,
      message: `اليوم هو موعد خروج ${b.customers?.full_name || ''} للحجز رقم ${b.id.slice(0, 8).toUpperCase()} من الغرفة ${b.units?.unit_number || ''} (${b.hotels?.name || ''})`,
      customer: b.customers,
      unit: b.units,
      hotel: b.hotels,
    });
  });

  const allEvents = [...(events || []), ...syntheticEvents].sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
            <Bell size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">تنبيهات النظام</h1>
            <p className="text-gray-500 text-sm">متابعة الأحداث المهمة للحجوزات والوحدات والموظفين</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            إجمالي التنبيهات: {allEvents.length}
          </span>
        </div>

        {allEvents.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            لا توجد تنبيهات حالياً
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {allEvents.map((event: any) => {
              const meta = EVENT_LABELS[event.event_type] || {
                label: event.event_type,
                icon: Bell,
                color: 'bg-gray-100 text-gray-700',
              };
              const Icon = meta.icon;

              return (
                <div key={event.id} className="px-6 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                  <div className={`mt-1 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${meta.color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{meta.label}</span>
                      {event.customer?.full_name && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <User size={12} />
                          {event.customer.full_name}
                        </span>
                      )}
                      {event.unit?.unit_number && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <Home size={12} />
                          {event.unit.unit_number}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-1">
                      {event.message}
                    </p>
                    <div className="mt-1 text-xs text-gray-400">
                      {new Date(event.created_at).toLocaleString('ar-EG', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {event.hotel?.name && (
                        <span className="mx-2 text-gray-500">
                          • {event.hotel.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

