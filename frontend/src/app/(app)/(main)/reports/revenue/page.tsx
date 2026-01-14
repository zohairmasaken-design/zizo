'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { KPICard } from '@/components/dashboard/KPICard';
import { RevenueChart } from '@/components/dashboard/RevenueChart';
import { 
  DollarSign, 
  Calendar, 
  TrendingUp, 
  ArrowRight, 
  Filter,
  Download,
  FileText
} from 'lucide-react';
import Link from 'next/link';

export default function RevenueReportPage() {
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [accounts, setAccounts] = useState<any[]>([]);
  
  // Date Range State
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // Start of current month
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Get Payment Method Accounts (Cash/Banks)
      const { data: paymentMethods, error: pmError } = await supabase
        .from('payment_methods')
        .select('id, name, account_id, accounts(name, code)');

      if (pmError) throw pmError;

      const accountIds = paymentMethods?.map(pm => pm.account_id).filter(id => id) || [];
      
      // Also map account_id to payment method name for display
      const accountMap = new Map();
      paymentMethods?.forEach(pm => {
        if (pm.account_id) {
          accountMap.set(pm.account_id, pm.name);
        }
      });

      if (accountIds.length === 0) {
        setRevenueData([]);
        setTotalRevenue(0);
        setLoading(false);
        return;
      }

      // 2. Get Journal Lines (Cash Inflows only - Debit > 0)
      const { data: lines, error: linesError } = await supabase
        .from('journal_lines')
        .select(`
          id,
          credit,
          debit,
          description,
          account_id,
          journal_entries!inner (
            id,
            entry_date,
            voucher_number,
            status
          )
        `)
        .in('account_id', accountIds)
        .eq('journal_entries.status', 'posted')
        .gt('debit', 0) // Only Inflows (Money entering the account)
        .gte('journal_entries.entry_date', startDate)
        .lte('journal_entries.entry_date', endDate);

      if (linesError) throw linesError;

      // Process Data
      let total = 0;
      const processedLines = lines?.map((line: any) => {
        const amount = Number(line.debit) || 0; // Inflow Amount
        total += amount;
        return {
          ...line,
          amount,
          date: line.journal_entries.entry_date,
          account_name: accountMap.get(line.account_id) || 'غير معروف'
        };
      }) || [];

      // Sort by date desc
      processedLines.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setRevenueData(processedLines);
      setTotalRevenue(total);

    } catch (error) {
      console.error('Error fetching revenue report:', error);
    } finally {
      setLoading(false);
    }
  };

  // Prepare Chart Data (Group by Day)
  const chartData = React.useMemo(() => {
    const grouped = new Map();
    revenueData.forEach(item => {
      const date = item.date;
      const current = grouped.get(date) || 0;
      grouped.set(date, current + item.amount);
    });

    return Array.from(grouped.entries())
      .map(([date, amount]) => ({
        date: new Date(date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }),
        rawDate: date,
        amount: Number(amount)
      }))
      .sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime());
  }, [revenueData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/reports" className="text-gray-500 hover:text-gray-700 transition-colors">
              التقارير
            </Link>
            <span className="text-gray-400">/</span>
            <span className="font-bold text-gray-900">تقرير الإيرادات (المقبوضات)</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">تقرير الإيرادات (الأساس النقدي)</h1>
          <p className="text-gray-500 mt-1">تفاصيل المبالغ المستلمة في الصندوق والبنك (التدفقات النقدية الداخلة)</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <Calendar size={18} className="text-gray-400 ml-2" />
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-sm border-none focus:ring-0 p-0 text-gray-700"
              />
              <span className="text-gray-400">-</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-sm border-none focus:ring-0 p-0 text-gray-700"
              />
            </div>
          </div>
          
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium shadow-sm print:hidden"
          >
            <Download size={18} />
            تصدير
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <KPICard 
          title="إجمالي المقبوضات" 
          value={new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(totalRevenue)}
          change="-" 
          trend="neutral"
          icon={DollarSign}
          color="green"
          description="مجموع النقد المستلم في الحسابات"
        />
        <KPICard 
          title="عدد العمليات" 
          value={revenueData.length.toString()}
          change="-" 
          trend="neutral"
          icon={FileText}
          color="blue"
          description="عدد عمليات القبض المسجلة"
        />
        <KPICard 
          title="متوسط العملية" 
          value={new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(revenueData.length ? totalRevenue / revenueData.length : 0)}
          change="-" 
          trend="neutral"
          icon={TrendingUp}
          color="purple"
          description="متوسط قيمة القبض للعملية الواحدة"
        />
      </div>

      {/* Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3">
          <RevenueChart 
            data={chartData} 
            title="تحليل التدفقات النقدية الداخلة"
            description="توزيع المقبوضات حسب التاريخ"
          />
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-bold text-lg text-gray-900">سجل عمليات القبض</h3>
          <span className="text-sm text-gray-500">{revenueData.length} عملية</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-bold text-gray-900 text-sm">التاريخ</th>
                <th className="px-6 py-4 font-bold text-gray-900 text-sm">رقم القيد</th>
                <th className="px-6 py-4 font-bold text-gray-900 text-sm">البيان</th>
                <th className="px-6 py-4 font-bold text-gray-900 text-sm">طريقة الدفع (الحساب)</th>
                <th className="px-6 py-4 font-bold text-gray-900 text-sm">المبلغ المستلم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    جاري تحميل البيانات...
                  </td>
                </tr>
              ) : revenueData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    لا توجد بيانات للفترة المحددة
                  </td>
                </tr>
              ) : (
                revenueData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                      {new Date(item.date).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                      {item.journal_entries.voucher_number || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-md truncate">
                      {item.description || item.journal_entries.description || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800">
                        {item.account_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-green-600">
                      {new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(item.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
