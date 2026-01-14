import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PricingResult } from './PricingStep';
import { Wallet, CreditCard, Banknote, Loader2, ArrowRight, CheckCircle2, Globe } from 'lucide-react';

interface DepositStepProps {
  onNext: (data: DepositResult) => void;
  onBack: () => void;
  pricingResult: PricingResult;
  initialData?: DepositResult;
}

export interface DepositResult {
  depositAmount: number;
  paymentMethodId: string;
  paymentMethodName: string;
  referenceNumber?: string;
  isPaid: boolean;
}

interface PaymentMethod {
  id: string;
  name: string;
}

export const DepositStep: React.FC<DepositStepProps> = ({ onNext, onBack, pricingResult, initialData }) => {
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  
  const [depositAmount, setDepositAmount] = useState<number>(initialData?.depositAmount || Math.round(pricingResult.finalTotal / 2));
  const [selectedMethodId, setSelectedMethodId] = useState<string>(initialData?.paymentMethodId || '');
  const [referenceNumber, setReferenceNumber] = useState<string>(initialData?.referenceNumber || '');
  const [isPaid, setIsPaid] = useState<boolean>(initialData?.isPaid || true);

  useEffect(() => {
    const fetchMethods = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id, name')
        .eq('is_active', true);

      if (data) {
        setPaymentMethods(data);
        if (!selectedMethodId && data.length > 0) {
          setSelectedMethodId(data[0].id);
        }
      }
      
      // If no methods found (e.g. first run), add defaults locally or handle empty
      if (!data || data.length === 0) {
          // Fallback purely for UI dev if DB is empty
          // Updated to match user preference: Cash and AlAhli Bank
          // NOTE: These IDs will fail if DB expects UUID. User MUST run setup SQL.
          // Using dummy UUIDs might pass regex check but fail FK check. 
          // Better to warn or assume the user will fix DB.
          console.warn('No payment methods found in DB. Using fallback UI-only methods. Transaction will fail if not fixed.');
          setPaymentMethods([
              { id: '11111111-1111-1111-1111-111111111111', name: 'نقد (يحتاج إعداد)' },
              { id: '22222222-2222-2222-2222-222222222222', name: 'البنك الأهلي (يحتاج إعداد)' }
          ]);
          if(!selectedMethodId) setSelectedMethodId('11111111-1111-1111-1111-111111111111');
      }

      setLoading(false);
    };

    fetchMethods();
  }, []);

  const handleNext = () => {
    const method = paymentMethods.find(m => m.id === selectedMethodId);
    onNext({
      depositAmount,
      paymentMethodId: selectedMethodId,
      paymentMethodName: method?.name || '',
      referenceNumber,
      isPaid
    });
  };

  const getIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('نقد') || n.includes('cash')) return <Banknote size={24} />;
    if (n.includes('تحويل') || n.includes('transfer') || n.includes('bank') || n.includes('بنك') || n.includes('alahli')) return <Wallet size={24} />;
    if (n.includes('booking') || n.includes('agoda') || n.includes('airbnb') || n.includes('expedia') || n.includes('gathern') || n.includes('منصة') || n.includes('platform')) return <Globe size={24} />;
    return <CreditCard size={24} />;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Payment Form */}
        <div className="space-y-6">
            <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Wallet size={20} className="text-blue-600" />
                    تفاصيل العربون
                </h3>

                <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700">قيمة العربون المطلوب</label>
                    <div className="relative">
                        <input
                            type="number"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(Number(e.target.value))}
                            className="w-full p-4 pl-12 border rounded-xl text-2xl font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <span className="absolute left-4 top-5 text-gray-400 font-medium">ر.س</span>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setDepositAmount(pricingResult.finalTotal)}
                            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            كامل المبلغ ({pricingResult.finalTotal.toLocaleString()})
                        </button>
                        <button 
                            onClick={() => setDepositAmount(Math.round(pricingResult.finalTotal / 2))}
                            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            50% ({Math.round(pricingResult.finalTotal / 2).toLocaleString()})
                        </button>
                        <button 
                            onClick={() => setDepositAmount(0)}
                            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            بدون عربون (0)
                        </button>
                    </div>
                </div>

                {depositAmount > 0 && (
                    <div className="space-y-4 pt-4 border-t animate-in fade-in slide-in-from-top-2">
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-gray-700">طريقة الدفع</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {paymentMethods.map(method => (
                                    <button
                                        key={method.id}
                                        onClick={() => setSelectedMethodId(method.id)}
                                        className={`
                                            p-3 rounded-xl border flex flex-col items-center gap-2 transition-all
                                            ${selectedMethodId === method.id 
                                                ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-sm' 
                                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                            }
                                        `}
                                    >
                                        {getIcon(method.name)}
                                        <span className="text-xs font-bold">{method.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">رقم المرجع / ملاحظات الدفع</label>
                            <input 
                                type="text"
                                value={referenceNumber}
                                onChange={(e) => setReferenceNumber(e.target.value)}
                                placeholder="مثلاً: رقم الحوالة، أو آخر 4 أرقام من البطاقة"
                                className="w-full p-3 border rounded-xl text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <input 
                                type="checkbox"
                                id="isPaid"
                                checked={isPaid}
                                onChange={(e) => setIsPaid(e.target.checked)}
                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="isPaid" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
                                تم استلام المبلغ فعلياً (إنشاء سند قبض فوراً)
                            </label>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* Right: Summary */}
        <div className="space-y-6">
            <div className="bg-gray-50 border rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-gray-900 mb-4">ملخص المستحقات</h3>
                
                <div className="flex justify-between text-gray-600">
                    <span>إجمالي الفاتورة</span>
                    <span className="font-bold text-gray-900">{pricingResult.finalTotal.toLocaleString()} ر.س</span>
                </div>

                <div className="flex justify-between items-center text-blue-600 bg-blue-100 p-3 rounded-xl">
                    <span className="font-medium">المدفوع (العربون)</span>
                    <span className="font-bold text-lg">{depositAmount.toLocaleString()} ر.س</span>
                </div>

                <div className="border-t pt-4 flex justify-between items-center text-gray-900">
                    <span className="font-medium">المتبقي للدفع</span>
                    <span className="font-bold text-xl">
                        {(pricingResult.finalTotal - depositAmount).toLocaleString()} <span className="text-sm font-normal text-gray-500">ر.س</span>
                    </span>
                </div>
            </div>

            <div className="flex gap-4">
                <button
                    onClick={onBack}
                    className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-xl font-bold text-lg hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                >
                    <ArrowRight size={20} />
                    <span>رجوع</span>
                </button>
                <button
                    onClick={handleNext}
                    className="flex-[2] bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                >
                    <span>مراجعة وتأكيد الحجز</span>
                    <CheckCircle2 size={20} />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
