import React from 'react';
import { cn } from '@/lib/utils';
import { BedDouble, Wrench, Sparkles, User } from 'lucide-react';

export interface Unit {
  id: string;
  unit_number: string;
  status: string;
  guest_name?: string;
}

export const RoomStatusGrid = ({ units }: { units: Unit[] }) => {
    const getStatusStyle = (status: string) => {
        switch(status) {
            case 'available': return {
                wrapper: 'bg-emerald-50/50 hover:bg-emerald-50 border-emerald-100',
                icon: 'text-emerald-500',
                text: 'text-emerald-700',
                label: 'متاح',
                Icon: BedDouble
            };
            case 'occupied': return {
                wrapper: 'bg-blue-50/50 hover:bg-blue-50 border-blue-100',
                icon: 'text-blue-500',
                text: 'text-blue-700',
                label: 'مشغول',
                Icon: User
            };
            case 'cleaning': return {
                wrapper: 'bg-amber-50/50 hover:bg-amber-50 border-amber-100',
                icon: 'text-amber-500',
                text: 'text-amber-700',
                label: 'تنظيف',
                Icon: Sparkles
            };
            case 'maintenance': return {
                wrapper: 'bg-rose-50/50 hover:bg-rose-50 border-rose-100',
                icon: 'text-rose-500',
                text: 'text-rose-700',
                label: 'صيانة',
                Icon: Wrench
            };
            default: return {
                wrapper: 'bg-gray-50 hover:bg-gray-100 border-gray-200',
                icon: 'text-gray-500',
                text: 'text-gray-700',
                label: status,
                Icon: BedDouble
            };
        }
    };

    // Calculate stats
    const stats = {
        total: units.length,
        available: units.filter(u => u.status === 'available').length,
        occupied: units.filter(u => u.status === 'occupied').length,
        maintenance: units.filter(u => ['maintenance', 'cleaning'].includes(u.status)).length
    };

    return (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h3 className="font-bold text-lg text-gray-900">حالة الغرف</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        <span className="font-medium text-emerald-600">{stats.available} متاح</span> • 
                        <span className="font-medium text-blue-600 mx-1">{stats.occupied} مشغول</span> • 
                        <span className="font-medium text-amber-600">{stats.maintenance} غير جاهز</span>
                    </p>
                </div>
                <button className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                    عرض الجدول
                </button>
            </div>

            {units.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-gray-50/50 rounded-xl border border-dashed">
                    <BedDouble size={48} className="mb-3 opacity-20" />
                    <p>لا توجد وحدات مسجلة</p>
                 </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {units.map((unit) => {
                        const style = getStatusStyle(unit.status);
                        const StatusIcon = style.Icon;
                        
                        return (
                            <div 
                                key={unit.id} 
                                className={cn(
                                    "group relative p-3 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col items-center text-center gap-2 hover:shadow-md hover:-translate-y-0.5",
                                    style.wrapper
                                )}
                                title={unit.guest_name || style.label}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full bg-white/60 backdrop-blur-sm", style.text)}>
                                        {style.label}
                                    </span>
                                    <StatusIcon size={14} className={style.icon} />
                                </div>
                                
                                <span className="font-bold text-lg font-sans text-gray-800 group-hover:scale-110 transition-transform">
                                    {unit.unit_number}
                                </span>
                                
                                {unit.status === 'occupied' && (
                                    <div className="w-full pt-2 mt-auto border-t border-blue-200/50">
                                        <p className="text-[10px] text-blue-800 font-medium truncate w-full">
                                            {unit.guest_name || 'ضيف'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
