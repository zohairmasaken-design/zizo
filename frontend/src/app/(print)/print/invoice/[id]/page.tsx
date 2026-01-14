import React from 'react';
import { createClient } from '@/lib/supabase-server';
import { format } from 'date-fns';
import { notFound } from 'next/navigation';
import PrintActions from '../../PrintActions';

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  let invoice: any = null;
  let booking: any = null;

  // 1. Try to fetch Invoice
  const { data: foundInvoice } = await supabase
    .from('invoices')
    .select(`
      *,
      booking:bookings(
        *,
        customer:customers(*),
        unit:units(
          *,
          unit_type:unit_types(
            *,
            hotel:hotels(*)
          )
        )
      )
    `)
    .eq('id', id)
    .single();

  if (foundInvoice) {
    invoice = foundInvoice;
    booking = foundInvoice.booking;
  } else {
    // 2. Fallback: Fetch Booking directly (Preview Mode)
    const { data: foundBooking } = await supabase
      .from('bookings')
      .select(`
        *,
        customer:customers(*),
        unit:units(
          *,
          unit_type:unit_types(
            *,
            hotel:hotels(*)
          )
        )
      `)
      .eq('id', id)
      .single();
    
    booking = foundBooking;
  }

  if (!booking) {
    return notFound();
  }

  // Determine displayed values
  const invoiceNumber = invoice?.invoice_number || `INV-${booking.id.slice(0, 8).toUpperCase()}`;
  const issueDateStr = invoice?.invoice_date || invoice?.created_at || booking.created_at;
  const issueDate = new Date(issueDateStr);

  const rawSubtotal = invoice?.subtotal ?? booking.subtotal ?? 0;
  const additionalServices = (booking.additional_services as any[]) || [];
  const additionalServicesTotal = additionalServices.reduce(
    (acc: number, s: any) => acc + (s?.amount || 0),
    0
  );
  const discountAmount = booking.discount_amount || 0;

  const roomBaseAmount = rawSubtotal - additionalServicesTotal + discountAmount;

  const subtotal = rawSubtotal;
  const taxAmount = invoice?.tax_amount || booking.tax_amount || subtotal * 0.15;
  const total = invoice?.total_amount || booking.total_price || subtotal + taxAmount;
  
  // Hotel Info (Supplier)
  const hotel = booking.unit?.unit_type?.hotel || {
    name: 'شركة مساكن فندقية',
    address: 'المملكة العربية السعودية',
    phone: '',
    tax_number: '300000000000003' // Default Dummy Tax ID
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-white min-h-screen relative print:w-[80mm] print:max-w-none print:p-4 print:m-0 print:min-h-0 print:shadow-none" dir="rtl">
      <PrintActions />
      {/* Watermark/Background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center overflow-hidden">
        <div className="text-[200px] font-bold rotate-45 transform text-black whitespace-nowrap">
           {hotel.name}
        </div>
      </div>

      {/* Header */}
      <div className="relative z-10">
        <div className="flex flex-col sm:flex-row justify-between items-start border-b-4 border-gray-900 pb-6 mb-8 gap-4">
            <div className="flex flex-col items-start w-full sm:w-auto">
                {/* Logo Placeholder */}
                <div className="w-24 h-24 bg-gray-900 text-white flex items-center justify-center mb-4 rounded-lg shadow-sm">
                    <span className="font-bold text-xl">شعار</span>
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">{hotel.name}</h2>
                    <p className="text-sm text-gray-800 mt-1 max-w-[250px]">{hotel.address}</p>
                    <p className="text-sm text-gray-800 mt-1">الرقم الضريبي: <span className="font-mono font-bold text-gray-900">{hotel.tax_number || '300000000000003'}</span></p>
                </div>
            </div>
            
            <div className="text-left flex flex-col items-end w-full sm:w-auto">
                <h1 className="text-4xl font-extrabold text-gray-900 mb-1 uppercase tracking-wider">فاتورة ضريبية</h1>
                <p className="text-gray-900 font-bold text-lg mb-4 tracking-widest">TAX INVOICE</p>
                
                {/* QR Code Placeholder */}
                <div className="w-32 h-32 bg-white border-2 border-gray-900 p-2">
                    <div className="w-full h-full bg-gray-900 opacity-10 flex items-center justify-center text-xs text-center p-1">
                        QR Code Area
                        (ZATCA)
                    </div>
                </div>
            </div>
        </div>

        {/* Invoice Meta Data Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-gray-900 font-bold border-b border-gray-300 pb-2 mb-4 flex justify-between">
                    <span>بيانات الفاتورة</span>
                    <span className="text-xs text-gray-800 pt-1">Invoice Details</span>
                </h3>
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-900 text-sm">رقم الفاتورة / Invoice No:</span>
                        <span className="font-bold font-mono text-lg">{invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-900 text-sm">تاريخ الإصدار / Issue Date:</span>
                        <span className="font-bold font-mono">{format(issueDate, 'dd/MM/yyyy HH:mm')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-900 text-sm">تاريخ التوريد / Supply Date:</span>
                        <span className="font-bold font-mono text-sm">{format(new Date(booking.check_in), 'dd/MM/yyyy')} - {format(new Date(booking.check_out), 'dd/MM/yyyy')}</span>
                    </div>
                </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h3 className="text-gray-900 font-bold border-b border-gray-300 pb-2 mb-4 flex justify-between">
                    <span>بيانات العميل</span>
                    <span className="text-xs text-gray-800 pt-1">Customer Details</span>
                </h3>
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-900 text-sm">الاسم / Name:</span>
                        <span className="font-bold">{booking.customer?.full_name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-900 text-sm">رقم الهاتف / Phone:</span>
                        <span className="font-mono" dir="ltr">{booking.customer?.phone}</span>
                    </div>
                    {booking.customer?.national_id && (
                        <div className="flex justify-between items-center">
                            <span className="text-gray-900 text-sm">رقم الهوية / ID:</span>
                            <span className="font-mono">{booking.customer?.national_id}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Line Items Table */}
        <div className="mb-8 overflow-hidden rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full border-collapse bg-white min-w-[600px]">
                <thead>
                    <tr className="bg-gray-900 text-white">
                        <th className="py-4 px-4 text-right font-bold w-1/2">
                            الوصف
                            <span className="block text-xs font-normal opacity-75 mt-1">Description</span>
                        </th>
                        <th className="py-4 px-4 text-center font-bold">
                            الكمية
                            <span className="block text-xs font-normal opacity-75 mt-1">Qty</span>
                        </th>
                        <th className="py-4 px-4 text-center font-bold">
                            سعر الوحدة
                            <span className="block text-xs font-normal opacity-75 mt-1">Unit Price</span>
                        </th>
                        <th className="py-4 px-4 text-center font-bold">
                            المجموع
                            <span className="block text-xs font-normal opacity-75 mt-1">Subtotal</span>
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    <tr>
                        <td className="py-4 px-4 align-top">
                            <div className="font-bold text-base text-gray-900">إقامة فندقية - {booking.unit?.unit_type?.name}</div>
                            <div className="text-xs text-gray-800 mt-1">
                                وحدة رقم {booking.unit?.unit_number} ({booking.booking_type === 'yearly' ? 'حجز سنوي' : 'حجز يومي'})
                            </div>
                        </td>
                        <td className="py-4 px-4 text-center font-mono text-sm">
                            {booking.nights}
                        </td>
                        <td className="py-4 px-4 text-center font-mono text-sm">
                            {(roomBaseAmount / (booking.nights || 1)).toLocaleString()}
                        </td>
                        <td className="py-4 px-4 text-center font-mono font-bold text-sm">
                            {roomBaseAmount.toLocaleString()}
                        </td>
                    </tr>
                    {additionalServices.map((service: any, index: number) => (
                      <tr key={`service-${index}`}>
                        <td className="py-3 px-4 align-top">
                          <div className="font-medium text-sm text-gray-900">
                            {service.name || 'خدمة إضافية'}
                          </div>
                          {service.description && (
                            <div className="text-xs text-gray-700 mt-1">
                              {service.description}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-sm">
                          {service.quantity || 1}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-sm">
                          {(service.amount || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-sm">
                          {(service.amount || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {discountAmount > 0 && (
                      <tr>
                        <td className="py-3 px-4 align-top">
                          <div className="font-medium text-sm text-gray-900">خصم على الحجز</div>
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-sm">
                          1
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-sm">
                          -{discountAmount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-sm text-red-600">
                          -{discountAmount.toLocaleString()}
                        </td>
                      </tr>
                    )}
                </tbody>
            </table>
        </div>

        {/* Totals Section */}
        <div className="flex justify-end mb-12">
            <div className="w-full sm:w-1/2 lg:w-5/12">
                <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-gray-200">
                        <span className="text-gray-900 font-medium">الإجمالي (غير شامل الضريبة) <br/> <span className="text-xs text-gray-700">Total (Excl. VAT)</span></span>
                        <span className="font-mono font-bold text-lg">{subtotal.toLocaleString()} ر.س</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                        <span className="text-gray-900 font-medium">ضريبة القيمة المضافة (15%) <br/> <span className="text-xs text-gray-700">VAT (15%)</span></span>
                        <span className="font-mono font-bold text-lg text-red-600">{taxAmount.toLocaleString()} ر.س</span>
                    </div>
                    <div className="flex justify-between py-4 border-y-4 border-gray-900 bg-gray-50 px-4 -mx-4 mt-4">
                        <span className="font-extrabold text-xl text-gray-900">الإجمالي المستحق <br/> <span className="text-xs font-normal text-gray-800">Total Amount</span></span>
                        <span className="font-mono font-extrabold text-3xl text-gray-900">{total.toLocaleString()} <span className="text-lg font-normal text-gray-800">ر.س</span></span>
                    </div>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-8 border-t border-gray-200 text-center text-sm text-gray-800">
            <p className="mb-2">شكراً لاختياركم {hotel.name}</p>
            <p className="text-xs text-gray-800">هذه الفاتورة إلكترونية وصادرة عن النظام الآلي ولا تحتاج إلى توقيع.</p>
        </div>
      </div>
    </div>
  );
}
