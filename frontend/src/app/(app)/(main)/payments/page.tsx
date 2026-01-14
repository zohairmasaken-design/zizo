import React from 'react';
import { createClient } from '@/lib/supabase-server';
import { format } from 'date-fns';
import { CreditCard, Search, Filter, Calendar, Printer } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'المدفوعات',
};

function isAdvancePayment(payment: any) {
  const description = (payment?.description || '').toString();
  return description.includes('عربون') || description.includes('دفعة مقدمة');
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    method?: string;
    from?: string;
    to?: string;
    type?: string;
  }>;
}) {
  const { q, method, from, to, type } = await searchParams;

  const supabase = await createClient();

  const { data: payments, error } = await supabase
    .from('payments')
    .select(`
      *,
      customer:customers(full_name),
      payment_method:payment_methods(name),
      invoice:invoices(
        invoice_number,
        booking:bookings(id)
      )
    `)
    .order('payment_date', { ascending: false });

  if (error) {
    console.error('Error fetching payments:', error);
  }

  const { data: paymentMethods } = await supabase
    .from('payment_methods')
    .select('id, name, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true });

  const safePayments = (payments || []) as any[];
  const safePaymentMethods = (paymentMethods || []) as any[];

  let filteredPayments = safePayments;

  if (from) {
    const fromDate = new Date(from);
    if (!Number.isNaN(fromDate.getTime())) {
      filteredPayments = filteredPayments.filter((payment) => {
        if (!payment.payment_date) return false;
        const paymentDate = new Date(payment.payment_date);
        return paymentDate >= fromDate;
      });
    }
  }

  if (to) {
    const toDate = new Date(to);
    if (!Number.isNaN(toDate.getTime())) {
      filteredPayments = filteredPayments.filter((payment) => {
        if (!payment.payment_date) return false;
        const paymentDate = new Date(payment.payment_date);
        return paymentDate <= toDate;
      });
    }
  }

  if (method && method !== 'all') {
    filteredPayments = filteredPayments.filter(
      (payment) => payment.payment_method_id === method
    );
  }

  if (type && type !== 'all') {
    filteredPayments = filteredPayments.filter((payment) => {
      const isAdvance = isAdvancePayment(payment);
      if (type === 'invoice') {
        return payment.invoice_id != null && !isAdvance;
      }
      return isAdvance;
    });
  }

  if (q && q.trim().length > 0) {
    const query = q.trim().toLowerCase();
    filteredPayments = filteredPayments.filter((payment) => {
      const values = [
        payment.payment_number,
        payment.id,
        payment.customer?.full_name,
        payment.invoice?.invoice_number,
        payment.description,
      ];

      return values.some((value) => {
        if (!value) return false;
        return value.toString().toLowerCase().includes(query);
      });
    });
  }

  const hasActiveFilters =
    (q && q.trim().length > 0) ||
    (from && from.length > 0) ||
    (to && to.length > 0) ||
    (method && method !== 'all') ||
    (type && type !== 'all');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">المدفوعات</h1>
          <p className="text-gray-500 mt-1">سجل جميع سندات القبض والدفعات</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 space-y-4">
        <form className="flex flex-col md:flex-row gap-4 items-stretch" method="GET">
          <div className="flex-1 relative">
            <Search
              size={18}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              name="q"
              defaultValue={q || ''}
              placeholder="بحث برقم السند، العميل، الفاتورة أو البيان..."
              className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-gray-900"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Calendar
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="date"
                name="from"
                defaultValue={from || ''}
                className="pl-3 pr-10 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-gray-900"
              />
            </div>
            <div className="relative">
              <Calendar
                size={18}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="date"
                name="to"
                defaultValue={to || ''}
                className="pl-3 pr-10 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-gray-900"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <select
              name="method"
              defaultValue={method || 'all'}
              className="px-3 py-2.5 border border-gray-200 rounded-xl bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="all">كل طرق الدفع</option>
              {safePaymentMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            <select
              name="type"
              defaultValue={type || 'all'}
              className="px-3 py-2.5 border border-gray-200 rounded-xl bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="all">كل الأنواع</option>
              <option value="invoice">سداد فاتورة</option>
              <option value="advance">سند قبض / دفعة مقدمة</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 shadow-sm"
            >
              <Filter size={18} />
              <span>تطبيق</span>
            </button>

            {hasActiveFilters && (
              <Link
                href="/payments"
                className="text-sm text-gray-600 hover:text-red-600 underline-offset-4 hover:underline"
              >
                مسح الفلاتر
              </Link>
            )}
          </div>
        </form>

        <div className="text-xs text-gray-500 flex flex-wrap gap-3">
          <span>
            إجمالي السجلات: {safePayments.length.toLocaleString()} | المعروضة:{' '}
            {filteredPayments.length.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-right min-w-[1000px]">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 sm:px-6 sm:py-4 font-bold text-gray-900 whitespace-nowrap">رقم السند</th>
              <th className="px-4 py-3 sm:px-6 sm:py-4 font-bold text-gray-900">العميل</th>
              <th className="px-4 py-3 sm:px-6 sm:py-4 font-bold text-gray-900">الحجز / الفاتورة</th>
              <th className="px-4 py-3 sm:px-6 sm:py-4 font-bold text-gray-900 whitespace-nowrap">طريقة الدفع</th>
              <th className="px-4 py-3 sm:px-6 sm:py-4 font-bold text-gray-900 whitespace-nowrap">التاريخ</th>
              <th className="px-4 py-3 sm:px-6 sm:py-4 font-bold text-gray-900 whitespace-nowrap">المبلغ</th>
              <th className="px-4 py-3 sm:px-6 sm:py-4 font-bold text-gray-900 whitespace-nowrap">نوع العملية</th>
              <th className="px-4 py-3 sm:px-6 sm:py-4 font-bold text-gray-900">البيان</th>
              <th className="px-4 py-3 sm:px-6 sm:py-4 font-bold text-gray-900 text-center whitespace-nowrap">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredPayments.length > 0 ? (
              filteredPayments.map((payment: any) => {
                const voucherNumber =
                  payment.payment_number || payment.id.slice(0, 8).toUpperCase();

                const bookingLabel =
                  payment.invoice?.booking?.id
                    ? `حجز #${payment.invoice.booking.id
                        .slice(0, 8)
                        .toUpperCase()}`
                    : '-';

                const invoiceLabel = payment.invoice?.invoice_number
                  ? `فاتورة ${payment.invoice.invoice_number}`
                  : null;

                const isAdvance = isAdvancePayment(payment);

                const paymentType = isAdvance
                  ? 'عربون / دفعة مقدمة'
                  : payment.invoice_id != null
                  ? 'سداد فاتورة'
                  : 'سند قبض';

                const description = payment.description || '-';

                return (
                  <tr
                    key={payment.id}
                    className="hover:bg-gray-50 transition-colors odd:bg-white even:bg-gray-50"
                  >
                    <td className="px-4 py-3 sm:px-6 sm:py-4 font-mono font-medium text-gray-900 text-sm whitespace-nowrap">
                      {voucherNumber}
                    </td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 font-medium text-gray-900">
                      {payment.customer?.full_name || '-'}
                    </td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 text-gray-700 text-sm">
                      <div>{bookingLabel}</div>
                      {invoiceLabel && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {invoiceLabel}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 text-gray-900 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-bold">
                        <CreditCard size={14} />
                        {payment.payment_method?.name || 'غير محدد'}
                      </span>
                    </td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 text-gray-600 text-sm whitespace-nowrap">
                      {payment.payment_date
                        ? format(new Date(payment.payment_date), 'dd/MM/yyyy')
                        : '-'}
                    </td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 font-bold text-gray-900 whitespace-nowrap">
                      {payment.amount?.toLocaleString()} ر.س
                    </td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 text-sm font-bold text-gray-800 whitespace-nowrap">
                      {paymentType}
                    </td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 text-gray-500 text-sm max-w-xs">
                      {description}
                    </td>
                    <td className="px-4 py-3 sm:px-6 sm:py-4 text-center whitespace-nowrap">
                      <div className="flex justify-center gap-2">
                        <Link
                          href={`/print/receipt/${payment.id}`}
                          target="_blank"
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="طباعة سند القبض"
                        >
                          <Printer size={18} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-3 bg-gray-50 rounded-full text-gray-400">
                      <CreditCard size={32} />
                    </div>
                    <p className="font-medium">لا توجد مدفوعات / سندات قبض مسجلة</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
