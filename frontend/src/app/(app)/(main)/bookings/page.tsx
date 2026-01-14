import React from 'react';
import { BookingWizard } from '@/components/bookings/BookingWizard';

export default function BookingsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-500 px-1">
        <span>الحجوزات</span>
        <span>/</span>
        <span className="font-medium text-gray-900">حجز جديد</span>
      </div>

      <BookingWizard />
    </div>
  );
}
