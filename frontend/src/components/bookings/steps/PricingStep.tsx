import React, { useState, useEffect } from 'react';
import { UnitType, PriceCalculation } from '@/lib/pricing';
import { Receipt, Percent, Plus, Trash2, ArrowRight, Calculator, Coins } from 'lucide-react';

interface PricingStepProps {
  onNext: (data: PricingResult) => void;
  onBack: () => void;
  unitType: UnitType;
  calculation: PriceCalculation;
  initialData?: PricingResult;
}

export interface ExtraFee {
  id: string;
  name: string;
  amount: number;
}

export interface PricingResult {
  discountType: 'amount' | 'percent';
  discountValue: number;
  discountAmount: number;
  extras: ExtraFee[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  finalTotal: number; // After tax
}

export const PricingStep: React.FC<PricingStepProps> = ({ onNext, onBack, unitType, calculation, initialData }) => {
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>(initialData?.discountType || 'amount');
  const [discountValue, setDiscountValue] = useState<number>(initialData?.discountValue || 0);
  const [extras, setExtras] = useState<ExtraFee[]>(initialData?.extras || []);
  
  // New Extra Input State
  const [newExtraName, setNewExtraName] = useState('');
  const [newExtraAmount, setNewExtraAmount] = useState('');

  // Calculations
  const subtotal = calculation.totalPrice;
  
  const discountAmount = discountType === 'amount' 
    ? discountValue 
    : (subtotal * discountValue) / 100;

  const extrasTotal = extras.reduce((sum, extra) => sum + extra.amount, 0);
  
  const taxableAmount = Math.max(0, subtotal - discountAmount + extrasTotal);
  const taxRate = 0.15; // 15% VAT
  const taxAmount = taxableAmount * taxRate;
  const finalTotal = taxableAmount + taxAmount;

  const handleAddExtra = () => {
    if (!newExtraName || !newExtraAmount) return;
    const amount = parseFloat(newExtraAmount);
    if (isNaN(amount) || amount <= 0) return;

    setExtras([...extras, {
      id: Math.random().toString(36).substr(2, 9),
      name: newExtraName,
      amount
    }]);
    setNewExtraName('');
    setNewExtraAmount('');
  };

  const removeExtra = (id: string) => {
    setExtras(extras.filter(e => e.id !== id));
  };

  const handleNext = () => {
    onNext({
      discountType,
      discountValue,
      discountAmount,
      extras,
      subtotal,
      taxAmount,
      totalAmount: taxableAmount,
      finalTotal
    });
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Left Column: Breakdown & Extras */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Nightly Breakdown */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-gray-50/50 p-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                <Receipt size={16} className="text-blue-600" />
                تفاصيل الإقامة
              </h3>
              <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded-md border border-gray-100 shadow-sm">{calculation.nights} ليلة</span>
            </div>
            <div className="max-h-[250px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50/30 text-gray-500 font-medium sticky top-0 backdrop-blur-sm">
                  <tr>
                    <th className="px-4 py-2 text-right font-medium">التاريخ</th>
                    <th className="px-4 py-2 text-right font-medium">نوع السعر</th>
                    <th className="px-4 py-2 text-left font-medium">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {calculation.breakdown.map((item, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-2 text-gray-700 font-medium" dir="ltr">{item.date}</td>
                      <td className="px-4 py-2">
                        {item.isSeason ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600 text-[10px] font-medium border border-orange-100">
                            <Coins size={10} />
                            موسمي
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[10px]">افتراضي</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-left font-bold text-gray-900">
                        {item.price.toLocaleString()} <span className="text-[9px] text-gray-400 font-normal">ر.س</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50/50 font-bold border-t border-gray-100">
                  <tr>
                    <td colSpan={2} className="px-4 py-2 text-gray-600">المجموع الفرعي</td>
                    <td className="px-4 py-2 text-left text-blue-600">{subtotal.toLocaleString()} <span className="text-[9px] text-gray-400 font-normal">ر.س</span></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Extras & Services */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-2">
              <Plus size={16} className="text-green-600" />
              خدمات ورسوم إضافية
            </h3>
            
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                placeholder="اسم الخدمة"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-normal focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={newExtraName}
                onChange={e => setNewExtraName(e.target.value)}
              />
              <div className="relative w-24">
                <input
                  type="number"
                  placeholder="0"
                  className="w-full px-3 py-2 pl-8 border border-gray-200 rounded-lg text-xs font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-normal focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={newExtraAmount}
                  onChange={e => setNewExtraAmount(e.target.value)}
                />
                <span className="absolute left-2.5 top-2 text-gray-400 text-[10px]">ر.س</span>
              </div>
              <button
                onClick={handleAddExtra}
                className="bg-gray-900 text-white w-8 h-[34px] rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center shadow-sm"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="space-y-1.5">
              {extras.map((extra) => (
                <div key={extra.id} className="flex justify-between items-center px-3 py-2 bg-gray-50/50 rounded-lg border border-gray-100 group hover:border-gray-200 transition-all">
                  <span className="font-medium text-xs text-gray-700">{extra.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-xs text-gray-900">{extra.amount.toLocaleString()} <span className="text-[9px] text-gray-400 font-normal">ر.س</span></span>
                    <button 
                      onClick={() => removeExtra(extra.id)}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {extras.length === 0 && (
                <div className="text-center py-4 border border-dashed border-gray-200 rounded-lg">
                  <p className="text-gray-400 text-xs">لا توجد خدمات إضافية</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Summary & Discounts */}
        <div className="space-y-4">
          
          {/* Discount Section */}
          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
            <h3 className="font-bold text-sm text-gray-900 mb-3 flex items-center gap-2">
              <Percent size={16} className="text-purple-600" />
              الخصومات
            </h3>
            <div className="space-y-3">
              <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-100">
                <button
                  onClick={() => setDiscountType('amount')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${discountType === 'amount' ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  مبلغ ثابت
                </button>
                <button
                  onClick={() => setDiscountType('percent')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${discountType === 'percent' ? 'bg-white text-gray-900 shadow-sm border border-gray-100' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  نسبة مئوية
                </button>
              </div>
              
              <div className="relative">
                <input
                  type="number"
                  value={discountValue}
                  onChange={e => setDiscountValue(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-900 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none transition-all"
                  placeholder="0"
                />
                <span className="absolute left-3 top-2.5 text-gray-400 text-xs font-medium">
                  {discountType === 'amount' ? 'ر.س' : '%'}
                </span>
              </div>
              
              {discountValue > 0 && (
                <div className="text-xs text-purple-700 bg-purple-50 px-3 py-2 rounded-lg flex justify-between items-center border border-purple-100">
                  <span>قيمة الخصم:</span>
                  <span className="font-bold">-{discountAmount.toLocaleString()} ر.س</span>
                </div>
              )}
            </div>
          </div>

          {/* Final Summary Card */}
          <div className="bg-gray-900 text-white rounded-xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
            
            <h3 className="font-bold text-sm mb-4 flex items-center gap-2 text-gray-100">
              <Calculator size={16} />
              ملخص الحساب
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>إجمالي الإقامة ({calculation.nights} ليلة)</span>
                <span className="font-medium text-gray-200">{subtotal.toLocaleString()}</span>
              </div>
              
              {extrasTotal > 0 && (
                <div className="flex justify-between text-gray-400">
                  <span>خدمات إضافية</span>
                  <span className="text-green-400 font-medium">+{extrasTotal.toLocaleString()}</span>
                </div>
              )}

              {discountAmount > 0 && (
                <div className="flex justify-between text-gray-400">
                  <span>الخصم</span>
                  <span className="text-red-400 font-medium">-{discountAmount.toLocaleString()}</span>
                </div>
              )}

              <div className="h-px bg-gray-800 my-2"></div>

              <div className="flex justify-between text-gray-400">
                <span>المبلغ الخاضع للضريبة</span>
                <span className="font-medium text-gray-200">{taxableAmount.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-gray-400">
                <span>الضريبة (15%)</span>
                <span className="font-medium text-gray-200">{taxAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-800">
              <div className="flex justify-between items-end">
                <span className="text-gray-400 text-xs font-medium">الإجمالي النهائي</span>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white tracking-tight">{finalTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                  <span className="text-[10px] text-gray-500">ريال سعودي</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onBack}
              className="flex-1 bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-bold text-sm hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <ArrowRight size={16} />
              <span>رجوع</span>
            </button>
            <button
              onClick={handleNext}
              className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2"
            >
              <span>متابعة للدفع</span>
              <ArrowRight size={16} className="rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
