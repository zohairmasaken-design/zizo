import React from 'react';
import { createClient } from '@/lib/supabase-server';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import Link from 'next/link';
import { Eye, Printer, FileText, Calendar, User, Home, Filter } from 'lucide-react';

export const metadata = {
  title: 'سجل الحجوزات',
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending_deposit: { label: 'بانتظار العربون', color: 'bg-yellow-100 text-yellow-900' },
  confirmed: { label: 'مؤكد', color: 'bg-green-100 text-green-900' },
  checked_in: { label: 'تم الدخول', color: 'bg-blue-100 text-blue-900' },
  checked_out: { label: 'تم الخروج', color: 'bg-gray-100 text-gray-900' },
  cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-900' },
};

export default async function BookingsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const supabase = await createClient();
  const { status } = await searchParams;

  let query = supabase
    .from('bookings')
    .select(`
      *,
      customer:customers(full_name, phone),
      unit:units(unit_number, unit_type:unit_types(name))
    `)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data: bookings, error } = await query;

  if (error) {
    return <div className="text-red-500">حدث خطأ أثناء جلب البيانات: {error.message}</div>;
  }

  const FilterButton = ({ value, label }: { value: string, label: string }) => {
    const isActive = (status === value) || (!status && value === 'all');
    return (
      <Link
        href={value === 'all' ? '/bookings-list' : `/bookings-list?status=${value}`}
        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
          isActive
            ? 'bg-blue-600 text-white shadow-sm'
            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">سجل الحجوزات</h1>
          <p className="text-gray-500 mt-1">عرض وإدارة جميع الحجوزات المسجلة في النظام</p>
        </div>
        <Link 
          href="/bookings" 
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
        >
          <Calendar size={18} />
          حجز جديد
        </Link>
      </div>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2">
        <FilterButton value="all" label="الكل" />
        <FilterButton value="pending_deposit" label="بانتظار العربون" />
        <FilterButton value="confirmed" label="مؤكد" />
        <FilterButton value="checked_in" label="تم الدخول" />
        <FilterButton value="checked_out" label="تم الخروج" />
        <FilterButton value="cancelled" label="ملغي" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-100 border-b border-gray-200 text-gray-900 font-bold">
              <tr>
                <th className="px-6 py-4">رقم الحجز</th>
                <th className="px-6 py-4">العميل</th>
                <th className="px-6 py-4">الوحدة</th>
                <th className="px-6 py-4">تاريخ الوصول</th>
                <th className="px-6 py-4">تاريخ المغادرة</th>
                <th className="px-6 py-4">الحالة</th>
                <th className="px-6 py-4">المبلغ</th>
                <th className="px-6 py-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bookings?.map((booking: any) => {
                const statusInfo = STATUS_MAP[booking.status] || { label: booking.status, color: 'bg-gray-100 text-gray-900' };
                
                return (
                  <tr key={booking.id} className="hover:bg-gray-50 transition-colors odd:bg-white even:bg-gray-50">
                    <td className="px-6 py-4 font-mono font-bold text-gray-900">
                      <Link href={`/bookings-list/${booking.id}`} className="hover:text-blue-600 hover:underline">
                        #{booking.id.slice(0, 8).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{booking.customer?.full_name || 'غير معروف'}</div>
                      <div className="text-xs text-gray-500 font-mono" dir="ltr">{booking.customer?.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Home size={14} className="text-gray-400" />
                        <span className="font-medium text-gray-900">{booking.unit?.unit_number}</span>
                        <span className="text-gray-500 text-xs">({booking.unit?.unit_type?.name})</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {format(new Date(booking.check_in), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {format(new Date(booking.check_out), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">
                      {booking.total_price?.toLocaleString()} ر.س
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <Link 
                            href={`/bookings-list/${booking.id}`}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="عرض التفاصيل"
                        >
                            <Eye size={18} />
                        </Link>
                        <Link 
                            href={`/print/invoice/${booking.id}`}
                            target="_blank"
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="الفاتورة"
                        >
                            <FileText size={18} />
                        </Link>
                        <Link 
                            href={`/print/contract/${booking.id}`}
                            target="_blank"
                            className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="العقد"
                        >
                            <Printer size={18} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(!bookings || bookings.length === 0) && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500 font-medium">
                    لا توجد حجوزات مسجلة {status && status !== 'all' ? 'بهذه الحالة' : 'حالياً'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
