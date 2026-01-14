import React from 'react';
import { createClient } from '@/lib/supabase-server';
import { format } from 'date-fns';
import PrintActions from '../PrintActions';

interface SearchParams {
  mode?: string;
  id?: string;
  start?: string;
  end?: string;
}

export default async function StatementPrintPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { mode = 'account', id, start, end } = await searchParams;
  const supabase = await createClient();

  if (!id || !start || !end) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center text-red-700">
        <p className="font-bold text-lg">بيانات ناقصة لطباعة كشف الحساب</p>
        <p className="text-sm mt-2">يرجى العودة للصفحة الرئيسية لكشف الحساب وإعادة المحاولة.</p>
      </div>
    );
  }

  let openingBalance = 0;
  let lines: any[] = [];
  let title = '';
  let subtitle = '';

  if (mode === 'customer') {
    const { data: customer } = await supabase
      .from('customers')
      .select('full_name, phone')
      .eq('id', id)
      .single();

    title = customer?.full_name || 'كشف حساب عميل';
    subtitle = customer?.phone ? `جوال: ${customer.phone}` : '';

    const { data: rpcData } = await supabase.rpc('get_customer_statement', {
      p_customer_id: id,
      p_start_date: start,
      p_end_date: end,
    });

    lines = rpcData || [];

    const { data: accData } = await supabase
      .from('customer_accounts')
      .select('account_id')
      .eq('customer_id', id)
      .single();

    if (accData?.account_id) {
      const { data: opData } = await supabase
        .from('journal_lines')
        .select('debit, credit, journal_entries!inner(entry_date)')
        .eq('account_id', accData.account_id)
        .lt('journal_entries.entry_date', start)
        .eq('journal_entries.status', 'posted');

      if (opData) {
        openingBalance = opData.reduce(
          (acc: number, line: any) =>
            acc + (Number(line.debit) - Number(line.credit)),
          0
        );
      }
    }
  } else {
    const { data: account } = await supabase
      .from('accounts')
      .select('code, name')
      .eq('id', id)
      .single();

    title = account ? `${account.code} - ${account.name}` : 'كشف حساب مالي';
    subtitle = 'يشمل الحساب والحسابات الفرعية المرتبطة به (إن وجدت)';

    const { data: openBalData } = await supabase.rpc(
      'get_account_balance_recursive',
      {
        p_account_id: id,
        p_date: start,
      }
    );
    openingBalance = Number(openBalData) || 0;

    const { data: rpcLines } = await supabase.rpc('get_account_statement', {
      p_account_id: id,
      p_start_date: start,
      p_end_date: end,
    });

    lines = rpcLines || [];
  }

  const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);

  const startDate = new Date(start);
  const endDate = new Date(end);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white min-h-screen print:p-4 print:m-0 print:min-h-0" dir="rtl">
      <PrintActions />

      <div className="mb-6 border-b-4 border-gray-900 pb-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 bg-gray-900 text-white flex items-center justify-center rounded-lg shadow-sm">
              <span className="font-bold text-sm leading-tight text-center">
                شعار
                <br />
                المنشأة
              </span>
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-extrabold text-gray-900">
                مساكن الرفاهية للوحدات الفندقية
              </h2>
              <p className="text-sm text-gray-800">
                المملكة العربية السعودية - وحدات فندقية مفروشة
              </p>
              <p className="text-sm text-gray-800">
                الرقم الضريبي:{' '}
                <span className="font-mono font-bold text-gray-900">
                  300000000000003
                </span>
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-1">
              كشف حساب
            </h1>
            <p className="text-xs text-gray-700 tracking-widest">
              ACCOUNT STATEMENT
            </p>
            <div className="mt-3 bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-800 space-y-1">
              <p>
                الفترة من{' '}
                <span className="font-mono">
                  {format(startDate, 'dd/MM/yyyy')}
                </span>{' '}
                إلى{' '}
                <span className="font-mono">
                  {format(endDate, 'dd/MM/yyyy')}
                </span>
              </p>
              <p>
                تاريخ ووقت الطباعة:{' '}
                <span className="font-mono">
                  {format(new Date(), 'dd/MM/yyyy HH:mm')}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-700">
                {mode === 'customer' ? 'العميل' : 'الحساب'}
              </span>
              <span className="text-xs text-gray-500">Account / Customer</span>
            </div>
            <p className="font-bold text-gray-900">{title}</p>
            {subtitle && (
              <p className="text-xs text-gray-600 mt-1">{subtitle}</p>
            )}
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-gray-700">ملاحظات</span>
              <span className="text-xs text-gray-500">Notes</span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              هذا الكشف تم توليده آلياً من نظام مساكن الرفاهية للوحدات
              الفندقية، ويعرض حركة الحساب خلال الفترة المحددة أعلاه مع رصيد
              افتتاحي وختامي.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="text-gray-600 mb-1">الرصيد الافتتاحي</div>
          <div className="font-bold font-mono text-gray-900">
            {openingBalance.toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="text-gray-600 mb-1">إجمالي المدين</div>
          <div className="font-bold font-mono text-green-700">
            {totalDebit.toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="text-gray-600 mb-1">إجمالي الدائن</div>
          <div className="font-bold font-mono text-red-700">
            {totalCredit.toLocaleString('en-US', {
              minimumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>

      <div className="border border-gray-300 rounded-lg overflow-hidden text-sm">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="py-2 px-2 text-right w-[90px]">التاريخ</th>
              <th className="py-2 px-2 text-right w-[90px]">رقم القيد</th>
              <th className="py-2 px-2 text-right">البيان</th>
              <th className="py-2 px-2 text-center w-[90px]">مدين</th>
              <th className="py-2 px-2 text-center w-[90px]">دائن</th>
              <th className="py-2 px-2 text-center w-[110px]">الرصيد</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-gray-50 border-b border-gray-200">
              <td className="py-2 px-2 text-right font-mono">
                {format(startDate, 'dd/MM/yyyy')}
              </td>
              <td className="py-2 px-2 text-right text-gray-500">-</td>
              <td className="py-2 px-2 font-bold text-gray-900">
                رصيد افتتاحي
              </td>
              <td className="py-2 px-2 text-center text-gray-700">-</td>
              <td className="py-2 px-2 text-center text-gray-700">-</td>
              <td className="py-2 px-2 text-center font-mono font-bold">
                {openingBalance.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                })}
              </td>
            </tr>
            {lines.length > 0 ? (
              lines.map((line, index) => (
                <tr
                  key={line.id || index}
                  className="border-b border-gray-100"
                >
                  <td className="py-1.5 px-2 text-right font-mono text-xs">
                    {line.transaction_date
                      ? format(new Date(line.transaction_date), 'dd/MM/yyyy')
                      : '-'}
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-xs">
                    {line.voucher_number || '-'}
                  </td>
                  <td className="py-1.5 px-2 text-right text-xs">
                    {line.description}
                  </td>
                  <td className="py-1.5 px-2 text-center font-mono text-xs text-green-700">
                    {Number(line.debit || 0) > 0
                      ? Number(line.debit).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })
                      : '-'}
                  </td>
                  <td className="py-1.5 px-2 text-center font-mono text-xs text-red-700">
                    {Number(line.credit || 0) > 0
                      ? Number(line.credit).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })
                      : '-'}
                  </td>
                  <td className="py-1.5 px-2 text-center font-mono text-xs font-bold">
                    {line.balance !== undefined && line.balance !== null
                      ? Number(line.balance).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })
                      : ''}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  className="py-6 px-4 text-center text-gray-500 text-sm"
                >
                  لا توجد حركات خلال هذه الفترة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-gray-500 flex justify-between">
        <span>نظام مساكن فندقية - كشف حساب آلي</span>
        <span>صفحة 1 / 1</span>
      </div>
    </div>
  );
}
