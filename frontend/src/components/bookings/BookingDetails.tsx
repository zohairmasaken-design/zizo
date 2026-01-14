'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { 
  ArrowLeft, Printer, Mail, MessageCircle, CreditCard, 
  CheckCircle, Banknote, Calendar, User, Home, FileText, 
  AlertCircle, Plus, X, Loader2, LogIn, LogOut, Ban
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface BookingDetailsProps {
  booking: any;
  transactions: any[];
  paymentMethods: any[];
  invoice?: any;
}

export default function BookingDetails({ booking, transactions: initialTransactions, paymentMethods, invoice: initialInvoice }: BookingDetailsProps) {
  const router = useRouter();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [invoice, setInvoice] = useState(initialInvoice);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  
  // Payment Form State
  const [amount, setAmount] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id || '');
  const [description, setDescription] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // Derived Financials
  const totalAmount = booking.total_price || 0;

  // Helper to safely get transaction type
  const getTransactionType = (txn: any) => {
    if (txn.transaction_type) return txn.transaction_type;
    
    // Identify Invoice Issue based on reference or description
    if (txn.reference_type === 'invoice' || txn.description?.includes('فاتورة مبيعات') || txn.description?.includes('Invoice')) {
        return 'invoice_issue';
    }

    // Identify Cancellation/Credit Note
    if (txn.transaction_type === 'credit_note' || txn.description?.includes('إلغاء') || txn.description?.includes('Credit Note')) {
        return 'credit_note';
    }

    return (txn.journal_lines?.[0]?.description?.includes('Advance') ? 'advance_payment' : 'payment');
  };

  const paidAmount = transactions
    .reduce((sum, t) => {
      const type = getTransactionType(t);
      
      // Ignore Invoice Issues (they create debt, they are not payments)
      if (type === 'invoice_issue') return sum;
      
      // Calculate amount from journal lines if available
      const debitAmount = Math.max(...(t.journal_lines?.map((l: any) => l.debit || 0) || [0]));
      const creditAmount = Math.max(...(t.journal_lines?.map((l: any) => l.credit || 0) || [0]));

      if (['payment', 'advance_payment'].includes(type)) {
        return sum + debitAmount;
      } else if (type === 'refund' || type === 'credit_note') {
         // Refunds and Credit Notes shouldn't necessarily reduce "Paid Amount" unless they are refunds of cash.
         // A Credit Note just reverses the Invoice (reduces debt).
         // A Refund (Debit AR/Cash?, Credit Cash) reduces cash.
         // If type is 'credit_note', it reverses revenue, not payment.
         if (type === 'refund') return sum - creditAmount;
         return sum;
      }
      return sum;
    }, 0);
  
  const remainingAmount = totalAmount - paidAmount;

  // Sync state with props
  React.useEffect(() => {
    setTransactions(initialTransactions);
    setInvoice(initialInvoice);
  }, [initialTransactions, initialInvoice]);

  const handleIssueInvoice = async () => {
    if (!confirm('هل أنت متأكد من إصدار الفاتورة؟ سيتم إنشاء قيد محاسبي وترحيل الدين على العميل.')) return;
    
    setIsIssuing(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // 1. Check/Create Invoice Record
      let targetInvoice = invoice;
      
      if (!targetInvoice) {
          const { data: newInvoice, error: invError } = await supabase
            .from('invoices')
            .insert({
              booking_id: booking.id,
              customer_id: booking.customer_id,
              invoice_number: `INV-${booking.booking_number || booking.id.slice(0, 8).toUpperCase()}`,
              subtotal: booking.subtotal,
              tax_amount: booking.tax_amount,
              discount_amount: booking.discount_amount, // Ensure these fields exist in booking or default to 0
              additional_services_amount: booking.additional_services?.reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0) || 0,
              total_amount: booking.total_price,
              status: 'posted',
              invoice_date: new Date().toISOString()
            })
            .select()
            .single();

          if (invError) throw invError;
          targetInvoice = newInvoice;
          setInvoice(newInvoice);
      } else if (targetInvoice.status === 'draft') {
          const { data: updatedInvoice, error: upError } = await supabase
            .from('invoices')
            .update({ status: 'posted', invoice_date: new Date().toISOString() })
            .eq('id', targetInvoice.id)
            .select()
            .single();
          
          if (upError) throw upError;
          targetInvoice = updatedInvoice;
          setInvoice(updatedInvoice);
      }

      // 2. Post Transaction (GL)
      // Calculate extras if any
      const extrasTotal = booking.additional_services?.reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0) || 0;

      const { error: txnError } = await supabase.rpc('post_transaction', {
        p_transaction_type: 'invoice_issue',
        p_source_type: 'invoice',
        p_source_id: targetInvoice.id,
        p_amount: booking.total_price,
        p_customer_id: booking.customer_id,
        p_payment_method_id: null,
        p_transaction_date: today,
        p_description: `فاتورة مبيعات #${targetInvoice.invoice_number}`,
        p_tax_amount: booking.tax_amount || 0
      });

      if (txnError) throw txnError;

      // Fetch latest transactions
      const referenceIds = [booking.id];
      if (targetInvoice?.id) referenceIds.push(targetInvoice.id);

      const { data: newTxns } = await supabase
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

      if (newTxns) {
        setTransactions(newTxns);
      }

      alert('تم إصدار الفاتورة وترحيل القيد بنجاح');
      router.refresh();
      
    } catch (err: any) {
      console.error('Invoice Error:', err);
      alert('حدث خطأ أثناء إصدار الفاتورة: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsIssuing(false);
    }
  };

  const handleCheckIn = async () => {
    if (!confirm('تأكيد تسجيل الدخول؟ سيتم أيضاً إصدار الفاتورة وترحيل القيد على حساب العميل.')) return;
    setLoading(true);
    try {
        const today = new Date().toISOString().split('T')[0];

        // --- 1. Invoice & Accounting Logic ---
        let targetInvoice = invoice;

        // A. Create or Update Invoice
        if (!targetInvoice) {
            const { data: newInvoice, error: invError } = await supabase
              .from('invoices')
              .insert({
                booking_id: booking.id,
                customer_id: booking.customer_id,
                invoice_number: `INV-${booking.booking_number || booking.id.slice(0, 8).toUpperCase()}`,
                subtotal: booking.subtotal,
                tax_amount: booking.tax_amount,
                discount_amount: booking.discount_amount,
                additional_services_amount: booking.additional_services?.reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0) || 0,
                total_amount: booking.total_price,
                status: 'posted', // Set directly to posted
                invoice_date: new Date().toISOString()
              })
              .select()
              .single();

            if (invError) throw invError;
            targetInvoice = newInvoice;
            setInvoice(newInvoice);
        } else if (targetInvoice.status === 'draft') {
            const { data: updatedInvoice, error: upError } = await supabase
              .from('invoices')
              .update({ status: 'posted', invoice_date: new Date().toISOString() })
              .eq('id', targetInvoice.id)
              .select()
              .single();
            
            if (upError) throw upError;
            targetInvoice = updatedInvoice;
            setInvoice(updatedInvoice);
        }

        // B. Post Transaction (if not already posted)
        // Check if we already have an 'invoice_issue' transaction for this invoice
        const hasInvoiceTxn = transactions.some(t => 
          t.reference_id === targetInvoice.id && 
          getTransactionType(t) === 'invoice_issue'
        );

        if (!hasInvoiceTxn) {
            const { error: txnError } = await supabase.rpc('post_transaction', {
              p_transaction_type: 'invoice_issue',
              p_source_type: 'invoice',
              p_source_id: targetInvoice.id,
              p_amount: booking.total_price,
              p_customer_id: booking.customer_id,
              p_payment_method_id: null,
              p_transaction_date: today,
              p_description: `فاتورة مبيعات #${targetInvoice.invoice_number}`,
              p_tax_amount: booking.tax_amount || 0
            });

            if (txnError) throw txnError;
        }

        // --- 2. Booking Status Logic ---
        const { error } = await supabase
            .from('bookings')
            .update({ status: 'checked_in' })
            .eq('id', booking.id);
      
        if (error) throw error;
      
        // --- 3. Unit Status Logic ---
        if (booking.unit_id) {
             await supabase.from('units').update({ status: 'occupied' }).eq('id', booking.unit_id);
        }

        try {
          const message = `تم تسجيل الدخول للحجز رقم ${booking.id.slice(0, 8).toUpperCase()} للعميل ${booking.customer?.full_name || ''} في الوحدة ${booking.unit?.unit_number || ''} من ${booking.check_in} إلى ${booking.check_out}`;
          await supabase.from('system_events').insert({
            event_type: 'check_in',
            booking_id: booking.id,
            unit_id: booking.unit_id,
            customer_id: booking.customer_id,
            hotel_id: booking.hotel_id || null,
            message,
            payload: {
              check_in: booking.check_in,
              check_out: booking.check_out
            }
          });
        } catch (eventError) {
          console.error('Failed to log check_in event:', eventError);
        }

        router.refresh();
        alert('تم تسجيل الدخول وإصدار الفاتورة بنجاح');
    } catch (err: any) {
        console.error('Check-in Error:', err);
        alert('حدث خطأ أثناء تسجيل الدخول: ' + (err.message || 'خطأ غير معروف'));
    } finally {
        setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (remainingAmount > 0) {
        if (!confirm(`المتبقي على العميل ${remainingAmount.toLocaleString()} ر.س. هل أنت متأكد من تسجيل الخروج قبل السداد الكامل؟`)) return;
    } else {
        if (!confirm('تأكيد تسجيل الخروج؟')) return;
    }
    setLoading(true);
    try {
        const { error } = await supabase
            .from('bookings')
            .update({ status: 'checked_out' })
            .eq('id', booking.id);
      
        if (error) throw error;

        // Update Unit Status
        if (booking.unit_id) {
             await supabase.from('units').update({ status: 'cleaning' }).eq('id', booking.unit_id);
        }

        try {
          const message = `تم تسجيل الخروج للحجز رقم ${booking.id.slice(0, 8).toUpperCase()} للعميل ${booking.customer?.full_name || ''} من الوحدة ${booking.unit?.unit_number || ''}`;
          await supabase.from('system_events').insert({
            event_type: 'check_out',
            booking_id: booking.id,
            unit_id: booking.unit_id,
            customer_id: booking.customer_id,
            hotel_id: booking.hotel_id || null,
            message,
            payload: {
              check_in: booking.check_in,
              check_out: booking.check_out
            }
          });

          if (booking.unit_id) {
            const cleaningMsg = `الغرفة ${booking.unit?.unit_number || ''} تحتاج إلى تنظيف بعد خروج الحجز رقم ${booking.id.slice(0, 8).toUpperCase()}`;
            await supabase.from('system_events').insert({
              event_type: 'room_needs_cleaning',
              booking_id: booking.id,
              unit_id: booking.unit_id,
              customer_id: booking.customer_id,
              hotel_id: booking.hotel_id || null,
              message: cleaningMsg
            });
          }
        } catch (eventError) {
          console.error('Failed to log checkout/cleaning events:', eventError);
        }

        router.refresh();
        alert('تم تسجيل الخروج بنجاح');
    } catch (err: any) {
        alert(err.message);
    } finally {
        setLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!confirm('هل أنت متأكد من إلغاء الحجز؟ سيتم حذف جميع القيود المحاسبية والفواتير ونقلها للأرشيف.')) return;
    setLoading(true);
    try {
        // Call the new cancellation function
        const { error } = await supabase.rpc('cancel_booking_fully', {
            p_booking_id: booking.id
        });

        if (error) throw error;

        router.refresh();
        alert('تم إلغاء الحجز وأرشفة القيود بنجاح');
    } catch (err: any) {
        console.error('Cancellation Error:', err);
        alert('حدث خطأ أثناء إلغاء الحجز: ' + (err.message || 'خطأ غير معروف'));
    } finally {
        setLoading(false);
    }
  };


  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount) {
      alert('يرجى إدخال المبلغ');
      return;
    }
    
    if (!paymentMethodId) {
      alert('يرجى اختيار طريقة الدفع');
      return;
    }

    setLoading(true);
    try {
      const numAmount = parseFloat(amount);
      
      // Check for Open Accounting Period
      const { data: period, error: periodError } = await supabase
        .from('accounting_periods')
        .select('id')
        .lte('start_date', paymentDate)
        .gte('end_date', paymentDate)
        .eq('status', 'open')
        .maybeSingle();

      if (periodError) throw periodError;
      if (!period) {
        throw new Error(`لا توجد فترة محاسبية مفتوحة للتاريخ المختار (${paymentDate}). يرجى فتح فترة محاسبية أولاً.`);
      }
      
      // Determine transaction type logic based on database constraints
      // If an 'invoice_issue' transaction exists, we are paying off AR -> use 'payment'
      // Otherwise, we are collecting advance -> use 'advance_payment'
      const hasInvoice = transactions.some(t => getTransactionType(t) === 'invoice_issue');
      
      const type = hasInvoice ? 'payment' : 'advance_payment';

      // Construct description with reference number
      const fullDescription = [
        description,
        referenceNumber ? `(Ref: ${referenceNumber})` : ''
      ].filter(Boolean).join(' ').trim() || (type === 'advance_payment' ? 'عربون / دفعة مقدمة' : 'سداد مستحقات');

      const { data: txnId, error } = await supabase.rpc('post_transaction', {
        p_transaction_type: type,
        p_source_type: 'booking',
        p_source_id: booking.id,
        p_amount: numAmount,
        p_customer_id: booking.customer_id,
        p_payment_method_id: paymentMethodId,
        p_transaction_date: paymentDate, // Use selected date
        p_description: fullDescription
      });

      if (error) throw error;

      if (txnId) {
        const paymentPayload: any = {
          customer_id: booking.customer_id,
          payment_method_id: paymentMethodId,
          amount: numAmount,
          payment_date: paymentDate,
          journal_entry_id: txnId,
          description: fullDescription,
          status: 'posted'
        };

        if (invoice?.id) {
          paymentPayload.invoice_id = invoice.id;
        }

        const { error: paymentError } = await supabase.from('payments').insert(paymentPayload);
        if (paymentError) {
          console.error('Failed to create payment record from BookingDetails:', paymentError);
        }
      }

      // Update Booking Status if it was pending_deposit
      if (booking.status === 'pending_deposit' && numAmount > 0) {
        await supabase
          .from('bookings')
          .update({ status: 'confirmed' })
          .eq('id', booking.id);
          
        router.refresh();
      }

      // Refresh transactions
      const referenceIds = [booking.id];
      if (invoice?.id) referenceIds.push(invoice.id);

      const { data: newTxns } = await supabase
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

      if (newTxns) {
        setTransactions(newTxns);
      }

      try {
        const beforeRemaining = remainingAmount + numAmount;
        const afterRemaining = remainingAmount;
        if (beforeRemaining > 0 && afterRemaining <= 0) {
          const msg = `تم سداد المبلغ المتبقي للعميل ${booking.customer?.full_name || ''} للحجز رقم ${booking.id.slice(0, 8).toUpperCase()}`;
          await supabase.from('system_events').insert({
            event_type: 'payment_settled',
            booking_id: booking.id,
            customer_id: booking.customer_id,
            hotel_id: booking.hotel_id || null,
            message: msg,
            payload: {
              amount: numAmount,
              payment_date: paymentDate
            }
          });
        }
      } catch (eventError) {
        console.error('Failed to log payment_settled event:', eventError);
      }
      
      setShowPaymentModal(false);
      setAmount('');
      setDescription('');
      setReferenceNumber('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      alert('تم تسجيل الدفعة بنجاح');
      router.refresh(); // Refresh server data

    } catch (err: any) {
      console.error('Payment Error:', err);
      alert('حدث خطأ أثناء تسجيل الدفعة: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setLoading(false);
    }
  };

  const waLink = `https://wa.me/${booking.customer?.phone}?text=${encodeURIComponent(
    `مرحباً ${booking.customer?.full_name}،\nتفاصيل حجزكم رقم ${booking.id.slice(0, 8)}:\nالوحدة: ${booking.unit?.unit_number}\nالمبلغ المتبقي: ${remainingAmount.toLocaleString('en-US')} ر.س\nشكراً لاختياركم لنا.`
  )}`;

  const mailLink = `mailto:${booking.customer?.email || ''}?subject=${encodeURIComponent(`تفاصيل الحجز #${booking.id.slice(0, 8)}`)}&body=${encodeURIComponent(
    `مرحباً ${booking.customer?.full_name}،\n\nتفاصيل حجزكم:\nرقم الحجز: ${booking.id}\nالوحدة: ${booking.unit?.unit_number}\nالمبلغ الإجمالي: ${totalAmount}\nالمبلغ المدفوع: ${paidAmount}\nالمتبقي: ${remainingAmount}\n\nشكراً لكم.`
  )}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/bookings-list" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={24} className="text-gray-900" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">تفاصيل الحجز</h1>
            <p className="text-sm text-gray-900 font-mono font-bold">#{booking.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {['confirmed', 'pending_deposit', 'checked_in'].includes(booking.status) && (
            <button 
              onClick={handleCancelBooking}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Ban size={18} />}
              <span>إلغاء الحجز</span>
            </button>
          )}

          {booking.status === 'confirmed' && (
            <button 
              onClick={handleCheckIn}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
              <span>تسجيل دخول</span>
            </button>
          )}

          {booking.status === 'checked_in' && (
            <button 
              onClick={handleCheckOut}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <LogOut size={18} />}
              <span>تسجيل خروج</span>
            </button>
          )}

          {invoice ? (
             <Link 
               href={`/print/invoice/${invoice.id}`}
               target="_blank"
               className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
             >
               <FileText size={18} />
               <span>طباعة الفاتورة #{invoice.invoice_number}</span>
             </Link>
          ) : (
            <>
              <button 
                onClick={handleIssueInvoice}
                disabled={isIssuing}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {isIssuing ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
                <span>إصدار فاتورة</span>
              </button>
              
              {/* Preview Only */}
              <Link 
                href={`/print/invoice/${booking.id}`}
                target="_blank"
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
              >
                <Printer size={18} />
                <span>معاينة الفاتورة</span>
              </Link>
            </>
          )}

          <button 
            onClick={() => setShowPaymentModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-900 font-medium transition-colors"
          >
            <CreditCard size={18} />
            <span>تسجيل دفعة</span>
          </button>

          <Link 
            href={`/print/contract/${booking.id}`}
            target="_blank"
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-900 font-medium transition-colors"
          >
            <Printer size={18} />
            <span>طباعة العقد</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Booking Status Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="text-blue-600" size={20} />
                بيانات الحجز
              </h2>
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                booking.status === 'confirmed' ? 'bg-green-100 text-green-900' :
                booking.status === 'pending_deposit' ? 'bg-yellow-100 text-yellow-900' :
                booking.status === 'checked_in' ? 'bg-blue-100 text-blue-900' :
                booking.status === 'cancelled' ? 'bg-red-100 text-red-900' :
                'bg-gray-100 text-gray-900'
              }`}>
                {booking.status === 'pending_deposit' ? 'بانتظار العربون' :
                 booking.status === 'confirmed' ? 'مؤكد' :
                 booking.status === 'checked_in' ? 'تم الدخول' :
                 booking.status === 'checked_out' ? 'تم الخروج' : 
                 booking.status === 'cancelled' ? 'ملغي' : booking.status}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-sm text-gray-900 font-semibold block mb-1">العميل</label>
                <div className="font-bold text-lg text-gray-900">{booking.customer?.full_name}</div>
                <div className="text-sm text-gray-900 font-mono font-medium">{booking.customer?.phone}</div>
              </div>
              <div>
                <label className="text-sm text-gray-900 font-semibold block mb-1">الوحدة</label>
                <div className="font-bold text-lg text-gray-900 flex items-center gap-2">
                  <Home size={16} className="text-gray-700" />
                  {booking.unit?.unit_number}
                </div>
                <div className="text-sm text-gray-900 font-medium">{booking.unit?.unit_type?.name}</div>
              </div>
              <div>
                <label className="text-sm text-gray-900 font-semibold block mb-1">تاريخ الوصول</label>
                <div className="font-bold text-lg text-gray-900">{format(new Date(booking.check_in), 'dd/MM/yyyy')}</div>
              </div>
              <div>
                <label className="text-sm text-gray-900 font-semibold block mb-1">تاريخ المغادرة</label>
                <div className="font-bold text-lg text-gray-900">{format(new Date(booking.check_out), 'dd/MM/yyyy')}</div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100 flex gap-3">
               <a 
                 href={waLink}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-50 text-green-800 font-bold rounded-lg hover:bg-green-100 transition-colors"
               >
                 <MessageCircle size={18} />
                 <span>واتساب</span>
               </a>
               <a 
                 href={mailLink}
                 className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-800 font-bold rounded-lg hover:bg-blue-100 transition-colors"
               >
                 <Mail size={18} />
                 <span>إيميل</span>
               </a>
            </div>
          </div>

          {/* Transactions History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Banknote className="text-blue-600" size={20} />
              سجل المدفوعات
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-900 font-bold">
                  <tr>
                    <th className="px-4 py-2 text-right">التاريخ</th>
                    <th className="px-4 py-2 text-right">النوع</th>
                    <th className="px-4 py-2 text-right">الوصف</th>
                    <th className="px-4 py-2 text-right">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.map((txn: any) => {
                     const amounts = txn.journal_lines?.map((l: any) => l.debit || 0) || [];
                     const amount = amounts.length > 0 ? Math.max(...amounts) : 0;
                     const type = getTransactionType(txn);

                     return (
                      <tr key={txn.id}>
                        <td className="px-4 py-3 text-gray-900 font-medium">{format(new Date(txn.entry_date), 'dd/MM/yyyy')}</td>
                        <td className="px-4 py-3 text-gray-900 font-medium">
                          {type === 'advance_payment' ? 'عربون' :
                           type === 'payment' ? 'سداد' :
                           type === 'refund' ? 'استرجاع' : 
                           type === 'invoice_issue' ? 'إصدار فاتورة' : type}
                        </td>
                        <td className="px-4 py-3 text-gray-900 font-medium">{txn.description}</td>
                        <td className="px-4 py-3 font-bold text-gray-900">
                          {amount.toLocaleString('en-US')} ر.س
                        </td>
                      </tr>
                    );
                  })}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-900 font-medium">
                        لا توجد حركات مالية مسجلة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Financial Summary Side Panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6">الملخص المالي</h2>
            
            <div className="space-y-4">
              {/* Detailed Breakdown */}
              <div className="space-y-2 pb-4 border-b border-gray-100 text-sm">
                <div className="flex justify-between items-center text-gray-600">
                  <span>المجموع الفرعي</span>
                  <span className="font-medium">{booking.subtotal?.toLocaleString('en-US')} <span className="text-xs">ر.س</span></span>
                </div>

                {booking.additional_services && Array.isArray(booking.additional_services) && booking.additional_services.length > 0 && (
                  <div className="flex justify-between items-center text-gray-600">
                    <span>خدمات إضافية</span>
                    <span className="font-medium text-green-600">
                        +{(booking.additional_services.reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0)).toLocaleString('en-US')} <span className="text-xs">ر.س</span>
                    </span>
                  </div>
                )}

                {booking.discount_amount > 0 && (
                  <div className="flex justify-between items-center text-gray-600">
                    <span>الخصم</span>
                    <span className="font-medium text-red-600">-{booking.discount_amount?.toLocaleString('en-US')} <span className="text-xs">ر.س</span></span>
                  </div>
                )}

                <div className="flex justify-between items-center text-gray-600">
                  <span>الضريبة (15%)</span>
                  <span className="font-medium">{booking.tax_amount?.toLocaleString('en-US')} <span className="text-xs">ر.س</span></span>
                </div>
              </div>

              <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                <span className="text-gray-900 font-bold">إجمالي الحجز</span>
                <span className="font-bold text-xl text-gray-900">{totalAmount.toLocaleString('en-US')} <span className="text-sm font-bold text-gray-900">ر.س</span></span>
              </div>
              
              <div className="flex justify-between items-center text-green-800">
                <span className="flex items-center gap-2 font-bold">
                  <CheckCircle size={16} />
                  المدفوع
                </span>
                <span className="font-bold text-lg">{paidAmount.toLocaleString('en-US')} <span className="text-sm font-bold">ر.س</span></span>
              </div>

              <div className="flex justify-between items-center text-red-800 pt-4 border-t border-gray-100">
                <span className="font-bold">المتبقي</span>
                <span className="font-bold text-2xl">{remainingAmount.toLocaleString('en-US')} <span className="text-sm font-bold">ر.س</span></span>
              </div>

              {remainingAmount > 0 && (
                <button
                  onClick={() => {
                    setAmount(remainingAmount.toString());
                    setShowPaymentModal(true);
                  }}
                  className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  <CreditCard size={20} />
                  سداد دفعة / عربون
                </button>
              )}
              
              {remainingAmount <= 0 && (
                <div className="mt-6 bg-green-50 text-green-800 py-3 rounded-xl text-center font-bold border border-green-200">
                  تم السداد بالكامل
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">تسجيل دفعة جديدة</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ (ر.س)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-lg"
                  placeholder="0.00"
                  required
                  min="1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الدفع</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم مرجعي (اختياري)</label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                    placeholder="Ref-123"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">طريقة الدفع</label>
                {paymentMethods.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {paymentMethods.map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethodId(method.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                          paymentMethodId === method.id
                            ? 'bg-blue-50 border-blue-500 text-blue-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {method.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-red-500 text-sm p-2 bg-red-50 rounded-lg border border-red-100">
                    لا توجد طرق دفع متاحة. يرجى إضافة طرق دفع في الإعدادات.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                  placeholder="وصف العملية..."
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="animate-spin" /> : <CheckCircle />}
                  تأكيد الدفع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
