import React from 'react';
import { createClient } from '@/lib/supabase-server';
import { format } from 'date-fns';
import { FileText, Printer } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'الفواتير',
};

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
  const supabase = await createClient();

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select(`
      *,
      customer:customers(full_name),
      booking:bookings(id)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching invoices:', error);
    return (
      <div className="p-6 bg-red-50 text-red-800 rounded-lg">
        <h2 className="font-bold mb-2">حدث خطأ أثناء تحميل الفواتير</h2>
        <p className="font-mono text-sm">{error.message}</p>
        <p className="text-sm mt-2">يرجى التحقق من صلاحيات المستخدم أو الاتصال بالدعم الفني.</p>
      </div>
    );
  }

  const safeInvoices = invoices || [];
  const totalInvoices = safeInvoices.length;
  const totalAmount = safeInvoices.reduce(
    (sum: number, inv: any) => sum + (inv.total_amount || 0),
    0
  );
  const paidAmount = safeInvoices
    .filter((inv: any) => inv.status === 'paid')
    .reduce((sum: number, inv: any) => sum + (inv.total_amount || 0), 0);
  const unpaidAmount = safeInvoices
    .filter((inv: any) => inv.status === 'posted')
    .reduce((sum: number, inv: any) => sum + (inv.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الفواتير</h1>
          <p className="text-gray-500 mt-1">إدارة وعرض الفواتير الضريبية</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">عدد الفواتير</p>
            <p className="mt-1 text-2xl font-extrabold text-gray-900">
              {totalInvoices.toLocaleString()}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
            <FileText size={22} />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-xs text-gray-500">إجمالي قيمة الفواتير</p>
          <p className="mt-1 text-xl font-extrabold text-gray-900">
            {totalAmount.toLocaleString()} <span className="text-sm font-bold">ر.س</span>
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-xs text-green-700">فواتير مدفوعة</p>
          <p className="mt-1 text-xl font-extrabold text-green-700">
            {paidAmount.toLocaleString()} <span className="text-sm font-bold">ر.س</span>
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-xs text-yellow-700">فواتير غير مدفوعة</p>
          <p className="mt-1 text-xl font-extrabold text-yellow-700">
            {unpaidAmount.toLocaleString()} <span className="text-sm font-bold">ر.س</span>
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-right min-w-[1000px]">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 sm:px-6 sm:py-4 font-bold text-gray-900 whitespace-nowrap">رقم الفاتورة</th>
              <th className="px-4 py-3 sm:px-6 sm:py-4 font-bold text-gray-900 whitespace-nowrap">العميل</th>
              <th className="px-4 py-3 sm:px-6 sm:py-4 font-bold text-gray-900 whitespace-nowrap">رقم الحجز</th>
              <th className="px-4 py-3 sm:px-6 sm:py-4 font-bold text-gray-900 whitespace-nowrap">التاريخ</th>
              <th className="px-4 py-3 sm:px-6 sm:py-4 font-bold text-gray-900 whitespace-nowrap">المبلغ</th>
              <th className="px-4 py-3 sm:px-6 sm:py-4 font-bold text-gray-900 whitespace-nowrap">الحالة</th>
              <th className="px-4 py-3 sm:px-6 sm:py-4 font-bold text-gray-900 text-center whitespace-nowrap">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {safeInvoices.length > 0 ? (
              safeInvoices.map((invoice: any) => (
                <tr
                  key={invoice.id}
                  className="hover:bg-gray-50 transition-colors odd:bg-white even:bg-gray-50"
                >
                  <td className="px-4 py-3 sm:px-6 sm:py-4 font-mono font-medium text-gray-900 whitespace-nowrap">
                    {invoice.invoice_number}
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4 font-medium text-gray-900 whitespace-nowrap">
                    {invoice.customer?.full_name || '-'}
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4 text-gray-600 font-mono whitespace-nowrap">
                    {invoice.booking?.id ? `#${invoice.booking.id.slice(0, 8).toUpperCase()}` : '-'}
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4 text-gray-600 whitespace-nowrap">
                    {invoice.invoice_date ? format(new Date(invoice.invoice_date), 'dd/MM/yyyy') : '-'}
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4 font-bold text-gray-900 whitespace-nowrap">
                    {invoice.total_amount?.toLocaleString()} ر.س
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                      invoice.status === 'posted' ? 'bg-yellow-100 text-yellow-800' :
                      invoice.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {invoice.status === 'paid' ? 'مدفوعة' : 
                       invoice.status === 'posted' ? 'غير مدفوعة' : 
                       invoice.status === 'draft' ? 'مسودة' : invoice.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 sm:px-6 sm:py-4 text-center whitespace-nowrap">
                    <div className="flex justify-center gap-2">
                      <Link 
                        href={`/print/invoice/${invoice.id}`}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="عرض / طباعة"
                      >
                        <Printer size={18} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-3 bg-gray-50 rounded-full text-gray-400">
                      <FileText size={32} />
                    </div>
                    <p className="font-medium">لا توجد فواتير حتى الآن</p>
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
