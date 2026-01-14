'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BookingData } from '../BookingWizard';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CheckCircle, Loader2, AlertCircle, FileText, Home, Printer, ArrowRight, Mail, MessageCircle, Share2, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ConfirmStepProps {
  data: BookingData;
  onSuccess: () => void;
  onBack: () => void;
}

export const ConfirmStep: React.FC<ConfirmStepProps> = ({ data, onSuccess, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const router = useRouter();

  const handleConfirm = async () => {
    if (!data.customer || !data.unitType || !data.startDate || !data.endDate || !data.pricingResult || !data.depositResult) {
      setError('بيانات الحجز غير مكتملة');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Create Booking
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          customer_id: data.customer.id,
          unit_id: data.unit?.id,
          check_in: format(data.startDate, 'yyyy-MM-dd'),
          check_out: format(data.endDate, 'yyyy-MM-dd'),
          nights: data.priceCalculation?.nights,
          total_price: data.pricingResult.finalTotal,
          tax_amount: data.pricingResult.taxAmount,
          subtotal: data.pricingResult.subtotal,
          discount_amount: data.pricingResult.discountAmount,
          additional_services: data.pricingResult.extras,
          status: data.depositResult.depositAmount > 0 ? 'confirmed' : 'pending_deposit',
          booking_type: data.bookingType || 'nightly'
        })
        .select()
        .single();

      if (bookingError) throw new Error(bookingError.message);
      if (!booking) throw new Error('فشل إنشاء الحجز');
      
      setBookingId(booking.id);

      try {
        const message = `تم حجز جديد للعميل ${data.customer.full_name} في الوحدة ${data.unit?.unit_number || '-'} من ${format(data.startDate, 'yyyy-MM-dd')} إلى ${format(data.endDate, 'yyyy-MM-dd')}`;
        await supabase.from('system_events').insert({
          event_type: 'booking_created',
          booking_id: booking.id,
          unit_id: data.unit?.id || null,
          customer_id: data.customer.id,
          hotel_id: data.unitType?.hotel_id || null,
          message,
          payload: {
            check_in: format(data.startDate, 'yyyy-MM-dd'),
            check_out: format(data.endDate, 'yyyy-MM-dd'),
            total_price: data.pricingResult.finalTotal
          }
        });
      } catch (eventError) {
        console.error('Failed to log booking_created event:', eventError);
      }

      // 2. Create Invoice (Draft)
      const invoiceNumber = `INV-${format(new Date(), 'yyyyMMdd')}-${Math.floor(Math.random() * 10000)}`;
      
      const extrasTotal = data.pricingResult.extras.reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0);

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          booking_id: booking.id,
          customer_id: data.customer.id,
          invoice_number: invoiceNumber,
          invoice_date: new Date().toISOString(),
          due_date: new Date().toISOString(),
          subtotal: data.pricingResult.subtotal,
          tax_amount: data.pricingResult.taxAmount,
          discount_amount: data.pricingResult.discountAmount,
          additional_services_amount: extrasTotal,
          total_amount: data.pricingResult.finalTotal,
          paid_amount: data.depositResult.depositAmount, // Reflect initial deposit
          status: 'draft' // Draft until checkout/posted
        })
        .select()
        .single();

      if (invoiceError) {
          console.error('Invoice creation failed:', invoiceError);
          // Don't block booking creation, but log it
      }

      // 3. Create Payment/Journal Entry if deposit > 0
      if (data.depositResult.depositAmount > 0 && data.depositResult.isPaid) {
          // A. Post Transaction (Journal Entry)
          const { data: journalId, error: transactionError } = await supabase.rpc('post_transaction', {
              p_transaction_type: 'advance_payment',
              p_source_type: 'booking',
              p_source_id: booking.id,
              p_amount: data.depositResult.depositAmount,
              p_customer_id: data.customer.id,
              p_payment_method_id: data.depositResult.paymentMethodId,
              p_transaction_date: new Date().toISOString(),
              p_description: `عربون حجز - ${data.customer.full_name}`
          });

          if (transactionError) {
              console.error('Failed to post transaction:', JSON.stringify(transactionError, null, 2));
              // Show actual error to help debugging
              alert(`تم إنشاء الحجز بنجاح، ولكن حدث خطأ في تسجيل المعاملة المالية: ${transactionError.message || transactionError.details || JSON.stringify(transactionError)}`);
          } else {
              // B. Create Payment Record (for Payments Page)
              const { error: paymentError } = await supabase
                  .from('payments')
                  .insert({
                      customer_id: data.customer.id,
                      invoice_id: invoice?.id, // Link to invoice if created
                      payment_method_id: data.depositResult.paymentMethodId,
                      amount: data.depositResult.depositAmount,
                      payment_date: new Date().toISOString(),
                      journal_entry_id: journalId, // Link to Journal Entry
                      description: `عربون حجز - ${data.customer.full_name}`,
                      status: 'posted'
                  });
              
              if (paymentError) {
                   console.error('Failed to create payment record:', paymentError);
              }
          }
      }

      // 4. Update Unit Status to 'occupied'
      if (data.unit?.id) {
          const { error: unitError } = await supabase
              .from('units')
              .update({ status: 'occupied' })
              .eq('id', data.unit.id);
          
          if (unitError) {
              console.error('Failed to update unit status:', unitError);
              // Non-critical error, logging is enough
          }
      }

      setSuccess(true);
      onSuccess();

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    const waLink = `https://wa.me/${data.customer?.phone}?text=${encodeURIComponent(
        `مرحباً ${data.customer?.full_name}،\nتم تأكيد حجزك لدينا بنجاح.\nرقم الحجز: ${bookingId?.slice(0, 8)}\nالوحدة: ${data.unit?.unit_number}\nمن: ${format(data.startDate!, 'yyyy-MM-dd')}\nإلى: ${format(data.endDate!, 'yyyy-MM-dd')}\nشكراً لاختياركم لنا.`
    )}`;
    
    const mailLink = `mailto:${data.customer?.email || ''}?subject=${encodeURIComponent(`تأكيد الحجز #${bookingId?.slice(0, 8)}`)}&body=${encodeURIComponent(
        `مرحباً ${data.customer?.full_name}،\n\nتم تأكيد حجزك بنجاح.\n\nتفاصيل الحجز:\nرقم الحجز: ${bookingId}\nالوحدة: ${data.unit?.unit_number}\nتاريخ الوصول: ${format(data.startDate!, 'yyyy-MM-dd')}\nتاريخ المغادرة: ${format(data.endDate!, 'yyyy-MM-dd')}\n\nشكراً لكم.`
    )}`;

    return (
      <div className="text-center py-12 space-y-8 animate-in zoom-in duration-500">
        <div className="space-y-4">
            <div className="flex justify-center">
                <div className="bg-green-100 p-6 rounded-full shadow-sm ring-8 ring-green-50">
                    <CheckCircle className="text-green-600 w-16 h-16" />
                </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-900">تم الحجز بنجاح!</h2>
            <p className="text-gray-500 max-w-md mx-auto">
                تم إنشاء الحجز رقم <span className="font-mono font-bold text-gray-700">#{bookingId?.slice(0, 8)}</span> للعميل {data.customer?.full_name}.
            </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto px-4">
            {/* Contract Card */}
            <div className="bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow text-right">
                <div className="flex items-center gap-4 mb-6">
                    <div className="bg-blue-100 p-3 rounded-xl">
                        <FileText className="text-blue-600 w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-gray-900">عقد الإيجار</h3>
                        <p className="text-sm text-gray-500">العقد الموحد للإيجار السكني</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => window.open(`/print/contract/${bookingId}`, '_blank')}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Eye size={16} />
                        عرض
                    </button>
                    <button 
                        onClick={() => window.open(`/print/contract/${bookingId}`, '_blank')}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Printer size={16} />
                        طباعة
                    </button>
                    <a 
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        <MessageCircle size={16} />
                        واتساب
                    </a>
                    <a 
                        href={mailLink}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Mail size={16} />
                        بريد
                    </a>
                </div>
            </div>

            {/* Invoice Card */}
            <div className="bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow text-right">
                <div className="flex items-center gap-4 mb-6">
                    <div className="bg-purple-100 p-3 rounded-xl">
                        <FileText className="text-purple-600 w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-gray-900">الفاتورة الضريبية</h3>
                        <p className="text-sm text-gray-500">فاتورة رقم #{bookingId?.slice(0, 8)}</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => window.open(`/print/invoice/${bookingId}`, '_blank')}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Eye size={16} />
                        عرض
                    </button>
                    <button 
                        onClick={() => window.open(`/print/invoice/${bookingId}`, '_blank')}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Printer size={16} />
                        طباعة
                    </button>
                    <a 
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        <MessageCircle size={16} />
                        واتساب
                    </a>
                    <a 
                        href={mailLink}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Mail size={16} />
                        بريد
                    </a>
                </div>
            </div>
        </div>

        <div className="pt-8">
            <button 
                onClick={() => router.push('/')}
                className="inline-flex items-center gap-2 px-8 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold transition-colors shadow-lg shadow-gray-200"
            >
                <Home size={20} />
                العودة للرئيسية
            </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-blue-600 w-12 h-12" />
      </div>
    );
  }

  // Calculate totals
  const extrasTotal = data.pricingResult?.extras.reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0;
  const hasDiscount = (data.pricingResult?.discountAmount || 0) > 0;
  const hasExtras = extrasTotal > 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Right Column: Customer & Unit Details */}
        <div className="md:col-span-2 space-y-6">
            {/* Customer Info */}
            <div className="bg-white border rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-bold">1</span>
                    </div>
                    بيانات العميل
                </h3>
                <div className="grid grid-cols-2 gap-6 text-sm">
                    <div>
                        <span className="block text-gray-500 mb-1">الاسم الكامل</span>
                        <span className="font-medium text-gray-900">{data.customer?.full_name}</span>
                    </div>
                    <div>
                        <span className="block text-gray-500 mb-1">نوع العميل</span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {data.customer?.customer_type === 'individual' ? 'أفراد' : 
                             data.customer?.customer_type === 'company' ? 'شركات' : 
                             data.customer?.customer_type === 'platform' ? 'منصة حجز' : 'وسيط'}
                        </span>
                    </div>
                    <div>
                        <span className="block text-gray-500 mb-1">رقم الهاتف</span>
                        <span className="font-medium text-gray-900 dir-ltr">{data.customer?.phone}</span>
                    </div>
                    <div>
                        <span className="block text-gray-500 mb-1">رقم الهوية / السجل</span>
                        <span className="font-medium text-gray-900">{data.customer?.national_id || data.customer?.commercial_register || '-'}</span>
                    </div>
                </div>
            </div>

            {/* Unit Info */}
            <div className="bg-white border rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-bold">2</span>
                    </div>
                    تفاصيل الوحدة والإقامة
                </h3>
                <div className="grid grid-cols-2 gap-6 text-sm">
                    <div>
                        <span className="block text-gray-500 mb-1">الوحدة المختارة</span>
                        <span className="font-medium text-gray-900 flex items-center gap-2">
                            <Home size={16} className="text-gray-400" />
                            {data.unitType?.name} - {data.unit?.unit_number}
                        </span>
                    </div>
                    <div>
                        <span className="block text-gray-500 mb-1">نوع الحجز</span>
                        <span className="font-medium text-gray-900">
                            {data.bookingType === 'daily' ? 'يومي' :
                            

                             data.bookingType === 'yearly' ? 'سنوي' : 'ليلي'}
                        </span>
                    </div>
                    <div>
                        <span className="block text-gray-500 mb-1">تاريخ الوصول</span>
                        <span className="font-medium text-gray-900">{data.startDate && format(data.startDate, 'dd/MM/yyyy')}</span>
                    </div>
                    <div>
                        <span className="block text-gray-500 mb-1">تاريخ المغادرة</span>
                        <span className="font-medium text-gray-900">{data.endDate && format(data.endDate, 'dd/MM/yyyy')}</span>
                    </div>
                    <div className="col-span-2 bg-blue-50 p-3 rounded-lg flex justify-between items-center">
                        <span className="text-blue-700 font-medium">مدة الإقامة</span>
                        <span className="text-blue-800 font-bold">{data.priceCalculation?.nights} ليلة</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Left Column: Financial Summary */}
        <div className="space-y-6">
            <div className="bg-gray-50 border rounded-2xl p-6 shadow-sm sticky top-6">
                <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <FileText size={20} className="text-gray-600" />
                    الملخص المالي
                </h3>
                
                <div className="space-y-3 text-sm pb-6 border-b border-gray-200">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-600">سعر الوحدة (لليلة)</span>
                        <span className="font-medium">{data.unitType?.daily_price} ر.س</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-600">المجموع الفرعي ({data.priceCalculation?.nights} ليلة)</span>
                        <span className="font-medium">{data.pricingResult?.subtotal?.toLocaleString()} ر.س</span>
                    </div>
                    
                    {/* Extras Section */}
                    {hasExtras && (
                        <div className="py-2 border-t border-dashed border-gray-200 mt-2">
                            <span className="block text-gray-500 text-xs mb-2">الخدمات الإضافية:</span>
                            {data.pricingResult?.extras.map((extra, idx) => (
                                <div key={idx} className="flex justify-between items-center text-gray-600 mb-1">
                                    <span>+ {extra.name}</span>
                                    <span>{extra.amount} ر.س</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Discounts Section */}
                    {hasDiscount && (
                        <div className="flex justify-between items-center text-red-600 bg-red-50 p-2 rounded-lg">
                            <span>الخصم ({data.pricingResult?.discountType === 'percent' ? '%' : 'مبلغ'})</span>
                            <span className="font-medium">- {data.pricingResult?.discountAmount?.toLocaleString()} ر.س</span>
                        </div>
                    )}

                    <div className="flex justify-between items-center text-gray-600 pt-2">
                        <span>الضريبة (15%)</span>
                        <span className="font-medium">{data.pricingResult?.taxAmount?.toLocaleString()} ر.س</span>
                    </div>
                </div>

                <div className="py-4 flex justify-between items-center">
                    <span className="font-bold text-lg text-gray-900">الإجمالي النهائي</span>
                    <span className="font-bold text-xl text-blue-600">{data.pricingResult?.finalTotal?.toLocaleString()} ر.س</span>
                </div>

                <div className="bg-white border rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">العربون المدفوع</span>
                        <span className="font-medium text-green-600">{data.depositResult?.depositAmount?.toLocaleString()} ر.س</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-100">
                        <span className="font-bold text-gray-800">المتبقي للدفع</span>
                        <span className="font-bold text-gray-800">
                            {( (data.pricingResult?.finalTotal || 0) - (data.depositResult?.depositAmount || 0) ).toLocaleString()} ر.س
                        </span>
                    </div>
                </div>

                <button
                    onClick={handleConfirm}
                    disabled={loading}
                    className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-200 transition-all flex justify-center items-center gap-2"
                >
                    {loading ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            جاري التأكيد...
                        </>
                    ) : (
                        <>
                            تأكيد الحجز وإصدار الفاتورة
                            <ArrowRight size={20} />
                        </>
                    )}
                </button>
                
                <button
                    onClick={onBack}
                    disabled={loading}
                    className="w-full mt-3 bg-white border border-gray-200 text-gray-600 font-medium py-3 px-4 rounded-xl hover:bg-gray-50 transition-colors"
                >
                    رجوع للتعديل
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
