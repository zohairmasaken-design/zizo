'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  FileText, 
  Calendar, 
  Download, 
  Printer, 
  Search,
  ArrowRight,
  Filter
} from 'lucide-react';
import Link from 'next/link';

interface TrialBalanceRow {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  opening_balance: number;
  period_debit: number;
  period_credit: number;
  net_balance: number;
}

export default function TrialBalancePage() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<TrialBalanceRow[]>([]);
  
  // Date Filters
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0] // Start of current year
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0] // Today
  );

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_trial_balance_v2', {
        start_date: startDate,
        end_date: endDate
      });

      if (error) throw error;
      setRows(data || []);
    } catch (err: any) {
      console.error('Error fetching trial balance:', err);
      // Show exact error for debugging
      alert('تفاصيل الخطأ: ' + (err.message || JSON.stringify(err)));
    } finally {
      setLoading(false);
    }
  };

  // Calculations for totals
  const totalOpening = rows.reduce((sum, row) => sum + Number(row.opening_balance), 0);
  const totalDebit = rows.reduce((sum, row) => sum + Number(row.period_debit), 0);
  const totalCredit = rows.reduce((sum, row) => sum + Number(row.period_credit), 0);
  const totalNet = rows.reduce((sum, row) => sum + Number(row.net_balance), 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link 
            href="/reports" 
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <ArrowRight size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="text-blue-600" />
              ميزان المراجعة
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              أرصدة الحسابات وحركتها خلال الفترة
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Printer size={18} />
            <span>طباعة</span>
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Download size={18} />
            <span>تصدير Excel</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <form 
          onSubmit={(e) => { e.preventDefault(); fetchReport(); }}
          className="flex flex-wrap items-end gap-4"
        >
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <Calendar size={14} />
              من تاريخ
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <Calendar size={14} />
              إلى تاريخ
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>

          <button 
            type="submit"
            className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <Filter size={18} />
            تحديث التقرير
          </button>
        </form>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-none">
        <div className="p-6 border-b border-gray-200 print:hidden">
          <div className="flex justify-between items-center">
            <h2 className="font-bold text-gray-900">تفاصيل الأرصدة</h2>
            <span className="text-sm text-gray-500">
              {rows.length} حساب
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 text-gray-700 text-sm font-semibold border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 w-32">رقم الحساب</th>
                <th className="px-6 py-4">اسم الحساب</th>
                <th className="px-6 py-4">النوع</th>
                <th className="px-6 py-4 text-left">رصيد افتتاحي</th>
                <th className="px-6 py-4 text-left text-green-600">مدين (حركة)</th>
                <th className="px-6 py-4 text-left text-red-600">دائن (حركة)</th>
                <th className="px-6 py-4 text-left font-bold">الرصيد الصافي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm text-gray-900">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    جاري تحميل البيانات...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    لا توجد بيانات للفترة المحددة
                  </td>
                </tr>
              ) : (
                <>
                  {rows.map((row) => (
                    <tr key={row.account_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-3 font-mono text-gray-600">{row.account_code}</td>
                      <td className="px-6 py-3 font-medium">{row.account_name}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                          row.account_type === 'asset' ? 'bg-green-100 text-green-700' :
                          row.account_type === 'liability' ? 'bg-red-100 text-red-700' :
                          row.account_type === 'equity' ? 'bg-purple-100 text-purple-700' :
                          row.account_type === 'revenue' ? 'bg-blue-100 text-blue-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {row.account_type === 'asset' ? 'أصول' :
                           row.account_type === 'liability' ? 'خصوم' :
                           row.account_type === 'equity' ? 'حقوق ملكية' :
                           row.account_type === 'revenue' ? 'إيرادات' : 'مصروفات'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-left dir-ltr">{Number(row.opening_balance).toLocaleString()}</td>
                      <td className="px-6 py-3 text-left dir-ltr text-green-600">{Number(row.period_debit).toLocaleString()}</td>
                      <td className="px-6 py-3 text-left dir-ltr text-red-600">{Number(row.period_credit).toLocaleString()}</td>
                      <td className="px-6 py-3 text-left dir-ltr font-bold">
                        {Number(row.net_balance).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                    <td colSpan={3} className="px-6 py-4 text-center">الإجمالي</td>
                    <td className="px-6 py-4 text-left dir-ltr">{totalOpening.toLocaleString()}</td>
                    <td className="px-6 py-4 text-left dir-ltr text-green-700">{totalDebit.toLocaleString()}</td>
                    <td className="px-6 py-4 text-left dir-ltr text-red-700">{totalCredit.toLocaleString()}</td>
                    <td className="px-6 py-4 text-left dir-ltr">{totalNet.toLocaleString()}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
