'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Box, Plus, Trash2, Calendar, DollarSign, Users, Layout, Check, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface UnitTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
}

interface Hotel {
  id: string;
  name: string;
}

interface PricingRule {
  start_date: string;
  end_date: string;
  price: number;
}

export default function UnitTypeModal({ isOpen, onClose, onSuccess, initialData }: UnitTypeModalProps) {
  const [loading, setLoading] = useState(false);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [showPriceWarning, setShowPriceWarning] = useState(false);
  
  const [formData, setFormData] = useState({
    hotel_id: '',
    name: '',
    description: '',
    area: 0,
    annual_price: 0,
    daily_price: 0,
    max_adults: 2,
    max_children: 0,
    features: [] as string[]
  });

  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [originalPrices, setOriginalPrices] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      fetchHotels();
      if (initialData) {
        setFormData({
            hotel_id: initialData.hotel_id,
            name: initialData.name,
            description: initialData.description || '',
            area: initialData.area || 0,
            annual_price: initialData.price_per_year || 0,
            daily_price: initialData.price_per_night || 0,
            max_adults: initialData.max_adults || 2,
            max_children: initialData.max_children || 0,
            features: initialData.features || []
        });
        fetchPricingRules(initialData.id);
        setOriginalPrices({
            annual: initialData.price_per_year || 0,
            daily: initialData.price_per_night || 0
        });
      } else {
        // Reset form for new entry
        setFormData({
            hotel_id: '',
            name: '',
            description: '',
            area: 0,
            annual_price: 0,
            daily_price: 0,
            max_adults: 2,
            max_children: 0,
            features: []
        });
        setPricingRules([]);
        setOriginalPrices(null);
      }
      setShowPriceWarning(false);
    }
  }, [isOpen, initialData]);

  const fetchHotels = async () => {
    const { data } = await supabase.from('hotels').select('id, name');
    if (data) setHotels(data);
  };

  const fetchPricingRules = async (unitTypeId: string) => {
      const { data } = await supabase
        .from('pricing_rules')
        .select('start_date, end_date, price')
        .eq('unit_type_id', unitTypeId)
        .eq('active', true);
      
      if (data) {
          setPricingRules(data);
          setOriginalPrices((prev: any) => ({ ...prev, rules: data }));
      }
  };

  const hasPriceChanged = () => {
      if (!originalPrices) return false;
      
      if (formData.annual_price !== originalPrices.annual) return true;
      if (formData.daily_price !== originalPrices.daily) return true;
      
      // Check rules changes (simplified check: count or values)
      const originalRules = originalPrices.rules || [];
      if (pricingRules.length !== originalRules.length) return true;
      
      // Deep check could be added here, but length + values usually enough for trigger
      return JSON.stringify(pricingRules) !== JSON.stringify(originalRules);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Price Change Warning Logic
    if (initialData && hasPriceChanged() && !showPriceWarning) {
        setShowPriceWarning(true);
        return;
    }

    if (!formData.hotel_id) {
      alert('الرجاء اختيار الفندق');
      return;
    }
    setLoading(true);

    try {
      let unitTypeId = initialData?.id;

      if (initialData) {
          // Update existing
          const { error } = await supabase
            .from('unit_types')
            .update({
                hotel_id: formData.hotel_id,
                name: formData.name,
                description: formData.description,
                area: formData.area,
                annual_price: formData.annual_price,
                daily_price: formData.daily_price,
                max_adults: formData.max_adults,
                max_children: formData.max_children,
                features: formData.features
            })
            .eq('id', initialData.id);
            
          if (error) throw error;
      } else {
          // Create new
          const { data: unitType, error } = await supabase
            .from('unit_types')
            .insert([{
              hotel_id: formData.hotel_id,
              name: formData.name,
              description: formData.description,
              area: formData.area,
              annual_price: formData.annual_price,
              daily_price: formData.daily_price,
              max_adults: formData.max_adults,
              max_children: formData.max_children,
              features: formData.features
            }])
            .select()
            .single();

          if (error) throw error;
          unitTypeId = unitType.id;
      }

      // Handle Pricing Rules (Delete all existing and re-insert for simplicity)
      if (unitTypeId) {
        // Only if we have rules or had rules (to clear them)
        if (pricingRules.length > 0 || (initialData && originalPrices?.rules?.length > 0)) {
            // Delete existing active rules for this unit type
            await supabase
                .from('pricing_rules')
                .delete()
                .eq('unit_type_id', unitTypeId);

            // Insert new rules
            if (pricingRules.length > 0) {
                const rulesPayload = pricingRules.map(rule => ({
                    unit_type_id: unitTypeId,
                    start_date: rule.start_date,
                    end_date: rule.end_date,
                    price: rule.price,
                    season: 'custom',
                    active: true
                }));

                const { error: rulesError } = await supabase
                    .from('pricing_rules')
                    .insert(rulesPayload);
                
                if (rulesError) throw rulesError;
            }
        }
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving unit type:', error);
      alert('حدث خطأ أثناء حفظ النموذج');
    } finally {
      setLoading(false);
      setShowPriceWarning(false);
    }
  };

  const addPricingRule = () => {
    setPricingRules([...pricingRules, { start_date: '', end_date: '', price: 0 }]);
  };

  const removePricingRule = (index: number) => {
    setPricingRules(pricingRules.filter((_, i) => i !== index));
  };

  const updatePricingRule = (index: number, field: keyof PricingRule, value: any) => {
    const newRules = [...pricingRules];
    newRules[index] = { ...newRules[index], [field]: value };
    setPricingRules(newRules);
  };

  const toggleFeature = (feature: string) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature]
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-100">
        {/* Price Change Warning Dialog */}
        {showPriceWarning && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex items-center justify-center p-6 rounded-2xl animate-in fade-in duration-200">
                <div className="bg-red-50 border-2 border-red-100 p-8 rounded-2xl max-w-md w-full shadow-xl text-center space-y-6">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
                        <AlertTriangle size={40} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-red-700 mb-2">تنبيه هام جداً!</h3>
                        <p className="text-gray-700 leading-relaxed">
                            أنت على وشك تغيير أسعار هذا النموذج. هذا الإجراء قد يؤثر على الحسابات المالية المستقبلية والعقود الجديدة.
                        </p>
                        <div className="mt-4 bg-white p-4 rounded-xl border border-red-100 text-sm text-right">
                            <p className="font-bold text-gray-900 mb-2">التغييرات المكتشفة:</p>
                            <ul className="list-disc list-inside space-y-1 text-gray-600">
                                {formData.annual_price !== originalPrices?.annual && (
                                    <li>تغيير السعر السنوي من <span className="font-mono font-bold">{originalPrices?.annual}</span> إلى <span className="font-mono font-bold text-red-600">{formData.annual_price}</span></li>
                                )}
                                {formData.daily_price !== originalPrices?.daily && (
                                    <li>تغيير السعر اليومي من <span className="font-mono font-bold">{originalPrices?.daily}</span> إلى <span className="font-mono font-bold text-red-600">{formData.daily_price}</span></li>
                                )}
                                {(pricingRules.length !== (originalPrices?.rules?.length || 0) || JSON.stringify(pricingRules) !== JSON.stringify(originalPrices?.rules)) && (
                                    <li>تعديل في فترات الأسعار الموسمية</li>
                                )}
                            </ul>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button 
                            type="button" 
                            onClick={() => setShowPriceWarning(false)} 
                            className="flex-1 py-3 border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-white transition-colors"
                        >
                            تراجع
                        </button>
                        <button 
                            type="button" 
                            onClick={handleSubmit} 
                            className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition-colors"
                        >
                            تأكيد وحفظ التغييرات
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600 shadow-sm ring-1 ring-indigo-100">
              <Box size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{initialData ? 'تعديل نموذج الوحدة' : 'نموذج وحدة جديد'}</h2>
              <p className="text-sm text-gray-500 mt-1">{initialData ? 'تعديل البيانات والأسعار' : 'تحديد مواصفات وأسعار نماذج الوحدات'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Basic Info & Features */}
            <div className="lg:col-span-2 space-y-8">
              {/* Basic Info */}
              <section className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Layout size={18} className="text-indigo-500" />
                  البيانات الأساسية
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">الفندق التابع له</label>
                    <select
                      required
                      value={formData.hotel_id}
                      onChange={e => setFormData({...formData, hotel_id: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"
                    >
                      <option value="">اختر الفندق...</option>
                      {hotels.map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">اسم النموذج</label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 placeholder:text-gray-400"
                      placeholder="مثال: غرفة وصالة، استوديو"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">المساحة (م²)</label>
                    <input
                      type="number"
                      value={formData.area}
                      onChange={e => setFormData({...formData, area: Number(e.target.value)})}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                    />
                  </div>

                   <div className="col-span-1 md:col-span-2 space-y-2">
                    <label className="text-sm font-medium text-gray-700">الوصف</label>
                    <textarea
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-24 text-gray-900 placeholder:text-gray-400"
                      placeholder="وصف تفصيلي للنموذج..."
                    />
                  </div>
                </div>
              </section>

              {/* Features */}
              <section className="bg-white p-6 rounded-2xl border border-gray-100 space-y-6 shadow-sm">
                 <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Check size={18} className="text-green-500" />
                    المميزات والتجهيزات
                 </h3>
                 <div className="flex flex-wrap gap-2">
                    {['مطبخ', 'شرفة', 'إطلالة بحرية', 'جاكوزي', 'غسالة', 'مكتب عمل', 'تلفاز ذكي', 'مايكرويف'].map(feat => {
                        const isSelected = formData.features.includes(feat);
                        return (
                          <button
                              key={feat}
                              type="button"
                              onClick={() => toggleFeature(feat)}
                              className={`
                                px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200
                                ${isSelected 
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' 
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                }
                              `}
                          >
                              {feat}
                          </button>
                        );
                    })}
                </div>
              </section>
            </div>

            {/* Right Column: Pricing & Occupancy */}
            <div className="space-y-8">
               {/* Occupancy */}
               <section className="bg-white p-6 rounded-2xl border border-gray-100 space-y-4 shadow-sm">
                 <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Users size={18} className="text-orange-500" />
                    السعة الاستيعابية
                 </h3>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs text-gray-500 font-medium">البالغين</label>
                        <input 
                            type="number" 
                            value={formData.max_adults} 
                            onChange={e => setFormData({...formData, max_adults: Number(e.target.value)})} 
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-center font-bold text-gray-900" 
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs text-gray-500 font-medium">الأطفال</label>
                        <input 
                            type="number" 
                            value={formData.max_children} 
                            onChange={e => setFormData({...formData, max_children: Number(e.target.value)})} 
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-center font-bold text-gray-900" 
                        />
                    </div>
                 </div>
               </section>

               {/* Pricing */}
               <section className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 space-y-6">
                <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                  <DollarSign size={18} className="text-indigo-600" />
                  إعدادات الأسعار
                </h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-indigo-800 uppercase tracking-wider">السعر السنوي</label>
                    <div className="relative">
                        <input
                        type="number"
                        value={formData.annual_price}
                        onChange={e => setFormData({...formData, annual_price: Number(e.target.value)})}
                        className="w-full pl-4 pr-10 py-3 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white font-bold text-lg text-gray-900"
                        />
                        <span className="absolute left-4 top-3.5 text-gray-400 text-sm font-medium">ريال</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-indigo-800 uppercase tracking-wider">السعر اليومي (الافتراضي)</label>
                    <div className="relative">
                        <input
                        type="number"
                        value={formData.daily_price}
                        onChange={e => setFormData({...formData, daily_price: Number(e.target.value)})}
                        className="w-full pl-4 pr-10 py-3 border border-indigo-200 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white font-bold text-lg text-gray-900"
                        />
                         <span className="absolute left-4 top-3.5 text-gray-400 text-sm font-medium">ريال</span>
                    </div>
                  </div>
                </div>
              </section>

               {/* Seasonal Pricing */}
               <section className="space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-bold text-gray-900">الأسعار الموسمية</label>
                        <button type="button" onClick={addPricingRule} className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-full hover:bg-indigo-200 font-medium flex items-center gap-1 transition-colors">
                            <Plus size={14} /> إضافة فترة
                        </button>
                    </div>
                    
                    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                        {pricingRules.length === 0 && (
                            <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
                                <Calendar className="mx-auto text-gray-300 mb-2" size={24} />
                                <p className="text-xs text-gray-500">لم يتم إضافة فترات موسمية</p>
                            </div>
                        )}
                        {pricingRules.map((rule, idx) => (
                            <div key={idx} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm space-y-3 relative group">
                                <button type="button" onClick={() => removePricingRule(idx)} className="absolute top-2 left-2 text-gray-300 hover:text-red-500 transition-colors">
                                    <Trash2 size={16} />
                                </button>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-gray-400">من</label>
                                        <input type="date" value={rule.start_date} onChange={e => updatePricingRule(idx, 'start_date', e.target.value)} className="w-full p-1.5 border rounded-lg text-xs bg-gray-50" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] text-gray-400">إلى</label>
                                        <input type="date" value={rule.end_date} onChange={e => updatePricingRule(idx, 'end_date', e.target.value)} className="w-full p-1.5 border rounded-lg text-xs bg-gray-50" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] text-gray-400">السعر للفترة</label>
                                    <input type="number" value={rule.price} onChange={e => updatePricingRule(idx, 'price', Number(e.target.value))} className="w-full p-1.5 border rounded-lg text-sm font-bold text-indigo-600" placeholder="0.00" />
                                </div>
                            </div>
                        ))}
                    </div>
               </section>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 mt-8 sticky bottom-0 bg-white z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 font-medium transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all hover:translate-y-[-1px] disabled:opacity-50"
            >
              <Save size={18} />
              {loading ? 'جاري الحفظ...' : 'حفظ النموذج'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
