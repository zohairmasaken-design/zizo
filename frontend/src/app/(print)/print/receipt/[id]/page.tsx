import React from 'react';
import { createClient } from '@/lib/supabase-server';
import { format } from 'date-fns';
import { notFound } from 'next/navigation';
import PrintActions from '../../PrintActions';

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: payment } = await supabase
    .from('payments')
    .select(`
      *,
      customer:customers(*),
      payment_method:payment_methods(name),
      invoice:invoices(
        invoice_number,
        booking:bookings(
          *,
          unit:units(
            *,
            unit_type:unit_types(
              *,
              hotel:hotels(*)
            )
          )
        )
      )
    `)
    .eq('id', id)
    .single();

  if (!payment) {
    return notFound();
  }

  const voucherNumber =
    payment.payment_number || payment.id.slice(0, 8).toUpperCase();

  const paymentDate = payment.payment_date
    ? new Date(payment.payment_date)
    : new Date(payment.created_at);

  const amount = Number(payment.amount) || 0;

  const hotel =
    payment.invoice?.booking?.unit?.unit_type?.hotel || ({
      name: 'شركة مساكن فندقية',
      address: 'المملكة العربية السعودية',
      phone: '',
      tax_number: '300000000000003',
    } as any);

  const isAdvance =
    typeof payment.description === 'string' &&
    (payment.description.includes('عربون') ||
      payment.description.includes('دفعة مقدمة'));

  const operationType = isAdvance
    ? 'عربون / دفعة مقدمة'
    : payment.invoice_id != null
    ? 'سداد فاتورة'
    : 'سند قبض / دفعة مقدمة';

  return (
    <div
      className="max-w-3xl mx-auto p-4 sm:p-8 bg-white min-h-screen relative print:max-w-none print:p-4 print:m-0 print:min-h-0 print:shadow-none"
      dir="rtl"
    >
      <PrintActions />
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center overflow-hidden">
        <div className="text-[170px] font-bold rotate-45 transform text-black whitespace-nowrap">
          {hotel.name}
        </div>
      </div>

      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row justify-between items-start border-b-4 border-gray-900 pb-6 mb-8 gap-4">
          <div className="flex flex-col items-start w-full sm:w-auto">
            <div className="w-20 h-20 bg-gray-900 text-white flex items-center justify-center mb-4 rounded-lg shadow-sm">
              <span className="font-bold text-lg">شعار</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{hotel.name}</h2>
              <p className="text-sm text-gray-800 mt-1 max-w-[260px]">
                {hotel.address}
              </p>
              <p className="text-sm text-gray-800 mt-1">
                الرقم الضريبي:{' '}
                <span className="font-mono font-bold text-gray-900">
                  {hotel.tax_number || '300000000000003'}
                </span>
              </p>
            </div>
          </div>

          <div className="text-left flex flex-col items-end w-full sm:w-auto">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-1 tracking-wider">
              سند قبض
            </h1>
            <p className="text-gray-900 font-bold text-base mb-4 tracking-widest">
              RECEIPT VOUCHER
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
            <h3 className="text-gray-900 font-bold border-b border-gray-300 pb-2 mb-4 flex justify-between">
              <span>بيانات السند</span>
              <span className="text-xs text-gray-800 pt-1">Receipt Details</span>
            </h3>
            <div className="space-y-3 text-sm text-gray-800">
              <div className="flex justify-between items-center">
                <span>رقم السند:</span>
                <span className="font-mono font-bold text-base">
                  {voucherNumber}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>تاريخ السند:</span>
                <span className="font-mono">
                  {format(paymentDate, 'dd/MM/yyyy')}
                </span>
              </div>
              {payment.invoice?.invoice_number && (
                <div className="flex justify-between items-center">
                  <span>رقم الفاتورة:</span>
                  <span className="font-mono">
                    {payment.invoice.invoice_number}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span>نوع العملية:</span>
                <span className="font-bold">{operationType}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
            <h3 className="text-gray-900 font-bold border-b border-gray-300 pb-2 mb-4 flex justify-between">
              <span>بيانات العميل</span>
              <span className="text-xs text-gray-800 pt-1">Customer Details</span>
            </h3>
            <div className="space-y-3 text-sm text-gray-800">
              <div className="flex justify-between items-center">
                <span>الاسم:</span>
                <span className="font-bold">
                  {payment.customer?.full_name || '-'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>رقم الهاتف:</span>
                <span className="font-mono" dir="ltr">
                  {payment.customer?.phone || '-'}
                </span>
              </div>
              {payment.customer?.national_id && (
                <div className="flex justify-between items-center">
                  <span>رقم الهوية:</span>
                  <span className="font-mono">
                    {payment.customer.national_id}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span>طريقة الدفع:</span>
                <span className="font-bold">
                  {payment.payment_method?.name || 'غير محدد'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8 border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full border-collapse bg-white">
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="py-3 px-4 text-right font-bold">
                  البيان
                  <span className="block text-xs font-normal opacity-75 mt-1">
                    Description
                  </span>
                </th>
                <th className="py-3 px-4 text-center font-bold w-40">
                  المبلغ
                  <span className="block text-xs font-normal opacity-75 mt-1">
                    Amount
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-200">
                <td className="py-4 px-4 align-top text-sm text-gray-900">
                  <div className="font-medium">
                    {payment.description || 'سند قبض نقدي'}
                  </div>
                  <div className="text-xs text-gray-700 mt-1">
                    تم استلام المبلغ أعلاه من العميل المذكور.
                  </div>
                </td>
                <td className="py-4 px-4 text-center font-mono font-extrabold text-lg text-gray-900">
                  {amount.toLocaleString()} ر.س
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start mt-10 text-sm text-gray-800 gap-6">
          <div>
            <div className="font-bold mb-2">المستلم</div>
            <div className="h-10 border-b border-gray-300 w-40" />
          </div>
          <div className="text-right max-w-md">
            <p className="mb-1">
              أقر أنا ممثل {hotel.name} باستلام المبلغ الموضح أعلاه.
            </p>
            <p className="text-xs text-gray-700">
              هذا السند إلكتروني وصادر عن النظام الآلي ولا يحتاج إلى توقيع أو ختم.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
