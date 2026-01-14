import React from 'react';
import { cn } from '@/lib/utils';
import { MoreHorizontal, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

export interface Booking {
  id: string;
  guest_name: string;
  unit_number: string;
  check_in: string;
  status: string;
  total_price: number;
}

export const RecentBookingsTable = ({ bookings }: { bookings: Booking[] }) => {
    const getStatusStyle = (status: string) => {
        switch(status) {
            case 'confirmed': return 'bg-blue-50 text-blue-700 ring-blue-600/20';
            case 'checked_in': return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
            case 'checked_out': return 'bg-gray-50 text-gray-700 ring-gray-600/20';
            case 'cancelled': return 'bg-rose-50 text-rose-700 ring-rose-600/20';
            default: return 'bg-gray-50 text-gray-700 ring-gray-600/20';
        }
    };
    
    const getStatusLabel = (status: string) => {
        switch(status) {
            case 'confirmed': return 'مؤكد';
            case 'checked_in': return 'دخول';
            case 'checked_out': return 'مغادرة';
            case 'cancelled': return 'ملغي';
            default: return status;
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full flex flex-col">
             <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-lg text-gray-900">أحدث الحجوزات</h3>
                    <p className="text-sm text-gray-500 mt-0.5">آخر 5 عمليات حجز مسجلة</p>
                </div>
                <Link 
                    href="/bookings-list"
                    className="group flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                >
                    عرض الكل
                    <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </Link>
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto flex-1">
                <table className="w-full text-sm text-right">
                    <thead className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4 font-semibold">رقم الحجز</th>
                            <th className="px-6 py-4 font-semibold">الضيف</th>
                            <th className="px-6 py-4 font-semibold">الوحدة</th>
                            <th className="px-6 py-4 font-semibold">تاريخ الدخول</th>
                            <th className="px-6 py-4 font-semibold">الحالة</th>
                            <th className="px-6 py-4 font-semibold text-left">المبلغ</th>
                            <th className="w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {bookings.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">لا توجد حجوزات حديثة</td>
                            </tr>
                        ) : (
                            bookings.map((booking) => (
                                <tr key={booking.id} className="group hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                            {booking.id.substring(0, 6)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] text-blue-600 font-bold">
                                                {booking.guest_name.charAt(0)}
                                            </div>
                                            {booking.guest_name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 font-sans font-medium">{booking.unit_number}</td>
                                    <td className="px-6 py-4 text-gray-500 font-sans text-xs">
                                        {new Date(booking.check_in).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={cn(
                                            "inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ring-1 ring-inset",
                                            getStatusStyle(booking.status)
                                        )}>
                                            {getStatusLabel(booking.status)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-left font-bold text-gray-900 font-sans">
                                        {new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(booking.total_price)}
                                    </td>
                                    <td className="px-4 text-right">
                                        <button className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
                                            <MoreHorizontal size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden flex flex-col divide-y divide-gray-50">
                {bookings.length === 0 ? (
                    <div className="px-6 py-12 text-center text-gray-500">لا توجد حجوزات حديثة</div>
                ) : (
                    bookings.map((booking) => (
                        <div key={booking.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm text-blue-600 font-bold">
                                        {booking.guest_name.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-sm">{booking.guest_name}</h4>
                                        <p className="text-xs text-gray-500 font-sans mt-0.5">#{booking.id.substring(0, 6)} • {booking.unit_number}</p>
                                    </div>
                                </div>
                                <span className={cn(
                                    "inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium ring-1 ring-inset",
                                    getStatusStyle(booking.status)
                                )}>
                                    {getStatusLabel(booking.status)}
                                </span>
                            </div>
                            
                            <div className="flex justify-between items-center pl-1">
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                    <span>دخول:</span>
                                    <span className="font-sans">
                                        {new Date(booking.check_in).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}
                                    </span>
                                </div>
                                <div className="font-bold text-gray-900 font-sans text-sm">
                                    {new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(booking.total_price)}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
