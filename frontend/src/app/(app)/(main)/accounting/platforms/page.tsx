'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Building2, 
  Wallet, 
  ArrowRightLeft, 
  TrendingUp, 
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Calendar,
  CreditCard,
  ChevronLeft
} from 'lucide-react';
import Link from 'next/link';

interface PlatformBalance {
  account_id: string;
  account_name: string;
  payment_method_name: string;
  balance: number;
  last_transaction_date: string;
}

interface BankAccount {
  id: string;
  name: string;
}

export default function PlatformAccountingPage() {
  const [platforms, setPlatforms] = useState<PlatformBalance[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Settlement Modal State
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformBalance | null>(null);
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [commissionAmount, setCommissionAmount] = useState<string>('0');
  const [targetBankId, setTargetBankId] = useState<string>('');
  const [settleDate, setSettleDate] = useState(new Date().toISOString().split('T')[0]);
  const [settleReference, setSettleReference] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchPlatforms(), fetchBankAccounts()]);
    setLoading(false);
  };

  const fetchPlatforms = async () => {
    const { data, error } = await supabase.rpc('get_platform_balances');
    if (error) console.error('Error fetching platforms:', error);
    else setPlatforms(data || []);
  };

  const fetchBankAccounts = async () => {
    // Fetch accounts under Fund (1100) -> Cash(1101) & Bank(1102) are children.
    // We can just fetch all Asset accounts that are NOT the platforms.
    // Better: Fetch payment methods accounts (which are usually cash/bank).
    const { data } = await supabase
      .from('accounts')
      .select('id, name')
      .in('code', ['1101', '1102']); // Cash and Bank specifically
    
    setBankAccounts(data || []);
    if (data && data.length > 0) setTargetBankId(data[0].id);
  };

  const handleOpenSettle = (platform: PlatformBalance) => {
    setSelectedPlatform(platform);
    setSettleAmount(platform.balance.toString());
    setCommissionAmount('0');
    setIsSettleModalOpen(true);
  };

  const handleSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlatform || !targetBankId) return;

    setProcessing(true);
    try {
      const { error } = await supabase.rpc('settle_platform_payment', {
        p_platform_account_id: selectedPlatform.account_id,
        p_target_bank_account_id: targetBankId,
        p_amount: parseFloat(settleAmount),
        p_commission_amount: parseFloat(commissionAmount),
        p_reference_number: settleReference,
        p_date: settleDate
      });

      if (error) throw error;

      alert('تمت التسوية بنجاح');
      setIsSettleModalOpen(false);
      fetchPlatforms(); // Refresh data
    } catch (err: any) {
      alert('خطأ في العملية: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const totalReceivables = platforms.reduce((sum, p) => sum + (p.balance || 0), 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="text-blue-600" />
            إدارة منصات الحجز
          </h1>
          <p className="text-gray-500 mt-1">متابعة مديونيات المنصات (Booking, Agoda, etc.) وتسوية الدفعات</p>
        </div>
        
        <div className="flex gap-3">
            <Link 
                href="/settings/payment-methods"
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
                <CreditCard size={18} />
                إعداد طرق الدفع
            </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">إجمالي مستحقات المنصات</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-2">
                {totalReceivables.toLocaleString('en-US')} <span className="text-sm font-normal text-gray-500">SAR</span>
              </h3>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
              <Wallet size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500">عدد المنصات النشطة</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-2">
                {platforms.filter(p => p.balance > 0).length}
              </h3>
            </div>
            <div className="p-3 bg-green-50 rounded-xl text-green-600">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Platforms Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">أرصدة المنصات</h2>
        </div>
        
        {loading ? (
          <div className="p-12 text-center text-gray-500">جاري التحميل...</div>
        ) : platforms.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-lg font-medium text-gray-900">لا توجد أرصدة للمنصات</h3>
            <p className="text-gray-500 mt-2 max-w-md mx-auto">
              تأكد من إعداد طرق الدفع وربطها بحسابات تحت بند "أرصدة منصات الحجز" (1120).
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/50">
                <tr>
                  <th className="px-6 py-4 text-right text-sm font-medium text-gray-500">المنصة / الحساب</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-gray-500">طريقة الدفع المرتبطة</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-gray-500">الرصيد الحالي</th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-gray-500">آخر حركة</th>
                  <th className="px-6 py-4 text-center text-sm font-medium text-gray-500">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {platforms.map((platform) => (
                  <tr key={platform.account_id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{platform.account_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      {platform.payment_method_name ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {platform.payment_method_name}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className={`font-bold ${platform.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {platform.balance.toLocaleString('en-US')} SAR
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {platform.balance > 0 ? 'لنا (مدين)' : 'علينا (دائن)'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {platform.last_transaction_date || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {platform.balance > 0 && (
                        <button
                          onClick={() => handleOpenSettle(platform)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
                        >
                          <DollarSign size={16} />
                          تسوية / استلام
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Settle Modal */}
      {isSettleModalOpen && selectedPlatform && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-900">تسوية رصيد {selectedPlatform.account_name}</h3>
              <button 
                onClick={() => setIsSettleModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-all"
              >
                <ChevronLeft className="rotate-180" size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSettle} className="p-6 space-y-4">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-blue-700 font-medium">الرصيد المستحق</span>
                  <span className="text-lg font-bold text-blue-800">{selectedPlatform.balance.toLocaleString()} SAR</span>
                </div>
                <p className="text-xs text-blue-600">
                  سيتم خصم مبلغ العمولة من الإجمالي، وإيداع الصافي في الحساب البنكي المختار.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ المستلم (الإجمالي)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">عمولة المنصة</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    value={commissionAmount}
                    onChange={(e) => setCommissionAmount(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">إيداع في حساب</label>
                <select
                  className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
                  value={targetBankId}
                  onChange={(e) => setTargetBankId(e.target.value)}
                  required
                >
                  {bankAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ التسوية</label>
                  <input
                    type="date"
                    required
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    value={settleDate}
                    onChange={(e) => setSettleDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم مرجعي (اختياري)</label>
                  <input
                    type="text"
                    placeholder="رقم الحوالة..."
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    value={settleReference}
                    onChange={(e) => setSettleReference(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 mt-4">
                <div className="flex justify-between items-center text-sm mb-4">
                  <span className="text-gray-600">صافي المبلغ للإيداع:</span>
                  <span className="font-bold text-green-600 text-lg">
                    {(parseFloat(settleAmount || '0') - parseFloat(commissionAmount || '0')).toLocaleString()} SAR
                  </span>
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsSettleModalOpen(false)}
                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={processing}
                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-bold flex justify-center items-center gap-2"
                  >
                    {processing ? (
                      <>جاري المعالجة...</>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        تأكيد التسوية
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
