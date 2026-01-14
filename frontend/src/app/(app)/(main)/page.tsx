import React from 'react';
import { 
  DollarSign, 
  Users, 
  BedDouble, 
  CalendarCheck,
  TrendingUp,
  Clock,
  ArrowRight,
  Download,
  Plus,
  Bell
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-server';
import { KPICard } from '@/components/dashboard/KPICard';
import { RoomStatusGrid, Unit } from '@/components/dashboard/RoomStatusGrid';
import { RecentBookingsTable, Booking } from '@/components/dashboard/RecentBookingsTable';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

export default async function Home() {
  const supabase = await createClient();

  // 1. Fetch Units Status
  const { data: unitsData } = await supabase
    .from('units')
    .select('id, unit_number, status')
    .order('unit_number');

  // Fetch active bookings to get guest names for occupied units
  const { data: activeBookings } = await supabase
    .from('bookings')
    .select('unit_id, customers(full_name)')
    .eq('status', 'checked_in');

  const activeBookingsMap = new Map();
  activeBookings?.forEach((b: any) => {
      if (b.unit_id) activeBookingsMap.set(b.unit_id, b.customers?.full_name);
  });

  const units: Unit[] = (unitsData || []).map((u: any) => ({
      id: u.id,
      unit_number: u.unit_number,
      status: u.status,
      guest_name: activeBookingsMap.get(u.id)
  }));

  // 2. Fetch Recent Bookings
  const { data: bookingsData } = await supabase
    .from('bookings')
    .select(`
      id,
      check_in,
      status,
      total_price,
      units (unit_number),
      customers (full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(5);

  const bookings: Booking[] = (bookingsData || []).map((b: any) => ({
    id: b.id,
    guest_name: b.customers?.full_name || 'غير معروف',
    unit_number: b.units?.unit_number || '-',
    check_in: b.check_in,
    status: b.status,
    total_price: Number(b.total_price) || 0
  }));

  // 3. Calculate KPIs
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfMonthStr = startOfMonth.toISOString().split('T')[0];

  // Try to get Cash Flow Stats (RPC) - Cash Basis
  const { data: cashFlowStats, error: statsError } = await supabase.rpc('get_cash_flow_stats');
  
  let totalRevenue = 0;
  let chartData: { date: string; amount: number }[] = [];

  if (!statsError && cashFlowStats) {
    totalRevenue = Number(cashFlowStats.month_revenue) || 0;
    const rawChartData = cashFlowStats.chart_data || [];
    chartData = rawChartData.map((d: any) => ({
      date: new Date(d.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }),
      amount: Number(d.amount)
    }));
  } else {
    // Fallback to Accrual Basis (revenue_schedules) if RPC missing
    console.warn('RPC get_cash_flow_stats failed/missing, falling back to revenue_schedules', statsError);
    
    const { data: revenueData } = await supabase
      .from('revenue_schedules')
      .select('amount, recognition_date')
      .gte('recognition_date', startOfMonthStr);
    
    totalRevenue = revenueData?.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0;

    // Chart Data (Last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    chartData = last7Days.map(date => ({
      date: new Date(date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }),
      amount: revenueData
        ?.filter(r => r.recognition_date === date)
        .reduce((sum, r) => sum + Number(r.amount), 0) || 0
    }));
  }

  // Occupancy
  const totalUnitsCount = units.length;
  const occupiedUnitsCount = units.filter(u => u.status === 'occupied').length;
  const occupancyRate = totalUnitsCount > 0 ? Math.round((occupiedUnitsCount / totalUnitsCount) * 100) : 0;

  // Active Bookings
  const activeBookingsCount = bookingsData?.filter((b: any) => b.status === 'checked_in').length || 0;
  
  // Pending Arrivals (Today)
  const todayStr = now.toISOString().split('T')[0];
  const { count: pendingArrivalsCount } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'confirmed')
    .eq('check_in', todayStr);

  // ==========================================
  // 4. Notifications & Reminders System
  // ==========================================

  // A. Generate "Delayed Check-in" Reminders
  // Find confirmed bookings where check_in < today (Late)
  const { data: delayedBookings } = await supabase
    .from('bookings')
    .select('id, customer_id, customers(full_name), unit_id, units(unit_number, hotel_id)')
    .eq('status', 'confirmed')
    .lt('check_in', todayStr);

  if (delayedBookings && delayedBookings.length > 0) {
    for (const booking of delayedBookings) {
      // Check if reminder already exists
      const { data: existing } = await supabase
        .from('system_events')
        .select('id')
        .eq('event_type', 'check_in_reminder')
        .eq('booking_id', booking.id)
        .gte('created_at', todayStr) // Only check if reminded today
        .single();
      
      if (!existing) {
        // Safe access to customer name
        const customerName = Array.isArray(booking.customers) 
          ? booking.customers[0]?.full_name 
          : (booking.customers as any)?.full_name || 'غير معروف';
          
        const msg = `تنبيه: تأخر تسجيل الدخول للحجز رقم ${booking.id.slice(0, 8)} للعميل ${customerName}`;
        await supabase.from('system_events').insert({
          event_type: 'check_in_reminder',
          booking_id: booking.id,
          unit_id: booking.unit_id,
          customer_id: booking.customer_id,
          hotel_id: (booking.units as any)?.hotel_id,
          message: msg
        });
      }
    }
  }

  // B. Generate "Check-out Today" Reminders
  // Find checked_in bookings where check_out = today
  const { data: checkoutBookings } = await supabase
    .from('bookings')
    .select('id, customer_id, customers(full_name), unit_id, units(unit_number, hotel_id)')
    .eq('status', 'checked_in')
    .eq('check_out', todayStr);

  if (checkoutBookings && checkoutBookings.length > 0) {
    for (const booking of checkoutBookings) {
      const { data: existing } = await supabase
        .from('system_events')
        .select('id')
        .eq('event_type', 'check_out_reminder')
        .eq('booking_id', booking.id)
        .gte('created_at', todayStr)
        .single();
      
      if (!existing) {
        const customerName = Array.isArray(booking.customers) 
          ? booking.customers[0]?.full_name 
          : (booking.customers as any)?.full_name || 'غير معروف';

        const msg = `تنبيه: موعد تسجيل الخروج اليوم للحجز رقم ${booking.id.slice(0, 8)} للعميل ${customerName}`;
        await supabase.from('system_events').insert({
          event_type: 'check_out_reminder',
          booking_id: booking.id,
          unit_id: booking.unit_id,
          customer_id: booking.customer_id,
          hotel_id: (booking.units as any)?.hotel_id,
          message: msg
        });
      }
    }
  }

  // C. Fetch Latest Notifications for Dashboard
  const { data: notifications } = await supabase
    .from('system_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(4);

  return (
    <div className="space-y-8 bg-[#f8fafc] h-full rounded-xl p-4 sm:p-6 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
        <div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">لوحة التحكم</h2>
            <p className="text-gray-500 mt-1 flex items-center gap-2">
              <Clock size={16} className="text-blue-500" />
              <span className="font-medium text-gray-700">أهلاً بك مجدداً.</span> إليك ملخص العمليات لليوم.
            </p>
        </div>
        <div className="flex w-full sm:w-auto gap-3">
            <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">
              <Download size={18} />
              تقرير اليوم
            </button>
            <Link 
              href="/bookings"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
            >
              <Plus size={18} />
              حجز جديد
            </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
            title="إيرادات الشهر" 
            value={new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(totalRevenue)} 
            change="+12%" 
            trend="up" 
            icon={TrendingUp}
            color="green"
            description="إجمالي الإيرادات المحصلة (صندوق/بنك)"
        />
        <KPICard 
            title="نسبة الإشغال" 
            value={`${occupancyRate}%`} 
            change="8%" 
            trend="up" 
            icon={BedDouble}
            color="blue"
            description="نسبة الوحدات المشغولة حالياً"
        />
        <KPICard 
            title="النزلاء حالياً" 
            value={activeBookingsCount.toString()} 
            change="2" 
            trend="up" 
            icon={Users}
            color="purple"
            description="عدد الحجوزات النشطة"
        />
        <KPICard 
            title="وصول اليوم" 
            value={(pendingArrivalsCount || 0).toString()} 
            change="-" 
            trend="neutral" 
            icon={CalendarCheck}
            color="orange"
            description="حجوزات متوقع وصولها اليوم"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <RevenueChart data={chartData} />
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-8 text-white shadow-xl shadow-blue-100 relative overflow-hidden group">
          <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
            <TrendingUp size={240} />
          </div>
          <div className="relative z-10 h-full flex flex-col">
            <h3 className="text-xl font-bold mb-2">نصيحة اليوم 💡</h3>
            <p className="text-blue-100 text-sm leading-relaxed mb-8">
              معدل الإشغال مرتفع هذا الأسبوع. تأكد من جاهزية فريق التنظيف لاستقبال الحجوزات القادمة وتحسين تجربة النزلاء.
            </p>
            <div className="mt-auto">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                <p className="text-xs text-blue-200 mb-1">الأكثر طلباً</p>
                <p className="font-bold">الغرف المطلة على المدينة</p>
              </div>
            </div>
            <button className="mt-6 flex items-center justify-center gap-2 w-full py-3 bg-white text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors">
              عرض التقارير التفصيلية
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-8">
          <RoomStatusGrid units={units} />
          <RecentBookingsTable bookings={bookings} />
        </div>
        
        {/* Sidebar Cards */}
        <div className="space-y-8">
           <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-gray-900">تنبيهات النظام</h3>
                <span className="bg-blue-100 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full">جديد</span>
              </div>
              <div className="space-y-4">
                {(notifications || []).length > 0 ? (
                  (notifications || []).map((item: any) => {
                     let color = 'bg-blue-500';
                     if (item.event_type === 'check_out_reminder') color = 'bg-amber-500';
                     if (item.event_type === 'check_in_reminder') color = 'bg-red-500';
                     if (item.event_type === 'new_booking') color = 'bg-emerald-500';
                     
                     return (
                      <div key={item.id} className="flex gap-4 group cursor-pointer">
                        <div className={`w-1 h-10 rounded-full shrink-0 ${color}`} />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-2">{item.message}</p>
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                            <Clock size={10} />
                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ar })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">لا توجد تنبيهات حالياً</p>
                )}
              </div>
              <Link href="/notifications" className="block w-full mt-6">
                <button className="w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gray-900 border border-gray-100 rounded-xl hover:bg-gray-50 transition-all">
                  مشاهدة كافة التنبيهات
                </button>
              </Link>
           </div>

           <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-600" />
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users size={28} className="text-blue-600" />
              </div>
              <h4 className="font-bold text-gray-900">هل تحتاج مساعدة؟</h4>
              <p className="text-sm text-gray-500 mt-2 mb-6">فريق الدعم الفني متاح 24/7 للإجابة على استفساراتك.</p>
              <button className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-all shadow-lg shadow-gray-200">
                تحدث مع الدعم
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
