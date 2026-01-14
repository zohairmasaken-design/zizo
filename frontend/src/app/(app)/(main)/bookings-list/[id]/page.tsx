import React from 'react';
import { createClient } from '@/lib/supabase-server';
import BookingDetails from '@/components/bookings/BookingDetails';
import { notFound } from 'next/navigation';

export const metadata = {
  title: 'تفاصيل الحجز',
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;

  // Fetch Booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(`
      *,
      customer:customers(*),
      unit:units(*, unit_type:unit_types(*))
    `)
    .eq('id', id)
    .single();

  if (bookingError || !booking) {
    return <div>الحجز غير موجود</div>;
  }

  // Fetch Invoice if exists
  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('booking_id', id)
    .single();

  // Fetch Transactions (Journal Entries linked to this booking OR its invoice)
  const referenceIds = [id];
  if (invoice?.id) {
    referenceIds.push(invoice.id);
  }

  const { data: transactions, error: txError } = await supabase
    .from('journal_entries')
    .select(`
      *,
      journal_lines(
        *,
        account:accounts(code, name)
      )
    `)
    .in('reference_id', referenceIds)
    .order('created_at', { ascending: false });

  // Fetch Payment Methods
  const { data: paymentMethods } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('is_active', true);

  return (
    <BookingDetails 
      booking={booking} 
      transactions={transactions || []} 
      paymentMethods={paymentMethods || []}
      invoice={invoice}
    />
  );
}
