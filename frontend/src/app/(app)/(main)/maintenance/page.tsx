import React from 'react';
import { Wrench } from 'lucide-react';

export default function MaintenancePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <div className="bg-orange-100 p-6 rounded-full mb-6">
        <Wrench size={48} className="text-orange-600" />
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">صيانة الوحدات</h1>
      <p className="text-gray-500 max-w-md">
        هذا القسم قيد التطوير. سيتم هنا إدارة طلبات الصيانة وتتبع حالة إصلاح الوحدات.
      </p>
    </div>
  );
}
