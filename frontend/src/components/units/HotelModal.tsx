'use client';

import React, { useState } from 'react';
import { X, Save, Building2, Phone, MapPin, FileText, Percent, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface HotelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
}

export default function HotelModal({ isOpen, onClose, onSuccess, initialData }: HotelModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'hotel',
    phone: '',
    description: '',
    tax_rate: 15,
    address: '',
    amenities: [] as string[]
  });

  React.useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          name: initialData.name,
          type: initialData.type || 'hotel',
          phone: initialData.phone || '',
          description: initialData.description || '',
          tax_rate: (initialData.tax_rate || 0) * 100,
          address: initialData.address || '',
          amenities: initialData.amenities || []
        });
      } else {
        setFormData({
          name: '',
          type: 'hotel',
          phone: '',
          description: '',
          tax_rate: 15,
          address: '',
          amenities: []
        });
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        phone: formData.phone,
        description: formData.description,
        tax_rate: formData.tax_rate / 100,
        address: formData.address,
        amenities: formData.amenities
      };

      if (initialData) {
        const { error } = await supabase
          .from('hotels')
          .update(payload)
          .eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('hotels')
          .insert([payload]);
        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating hotel:', error);
      alert('حدث خطأ أثناء إنشاء الفندق');
    } finally {
      setLoading(false);
    }
  };

  const toggleAmenity = (amenity: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-100">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-xl text-blue-600 shadow-sm ring-1 ring-blue-100">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{initialData ? 'تعديل بيانات الفندق' : 'إنشاء فندق جديد'}</h2>
              <p className="text-sm text-gray-500 mt-1">{initialData ? 'تعديل البيانات الأساسية والمرافق' : 'أدخل بيانات الفندق الأساسية والمرافق'}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Main Info Section */}
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b pb-2">
              <span className="w-1 h-5 bg-blue-600 rounded-full"></span>
              البيانات الأساسية
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">اسم الفندق</label>
                <div className="relative">
                  <Building2 className="absolute right-3 top-2.5 text-gray-400" size={18} />
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400"
                    placeholder="مثال: فندق مساكن"
                  />
                </div>
              </div>

              {/* Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">نوع العقار</label>
                <div className="relative">
                  <select
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50 focus:bg-white appearance-none text-gray-900"
                  >
                    <option value="hotel">فندق</option>
                    <option value="furnished_apartments">شقق مفروشة</option>
                    <option value="resort">منتجع</option>
                    <option value="compound">مجمع سكني</option>
                  </select>
                  <div className="absolute left-3 top-3 text-gray-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">رقم التواصل / الكود</label>
                <div className="relative">
                  <Phone className="absolute right-3 top-2.5 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50 focus:bg-white text-gray-900 placeholder:text-gray-400"
                    placeholder="05xxxxxxxx"
                  />
                </div>
              </div>

              {/* Tax Rate */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">نسبة الضريبة</label>
                <div className="relative">
                  <Percent className="absolute right-3 top-2.5 text-gray-400" size={18} />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.tax_rate}
                    onChange={e => setFormData({...formData, tax_rate: Number(e.target.value)})}
                    className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50 focus:bg-white"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="col-span-1 md:col-span-2 space-y-2">
                <label className="text-sm font-medium text-gray-700">العنوان</label>
                <div className="relative">
                  <MapPin className="absolute right-3 top-2.5 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={formData.address}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                    className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50 focus:bg-white text-gray-900"
                    placeholder="المدينة، الحي، الشارع..."
                  />
                </div>
              </div>

              {/* Description */}
              <div className="col-span-1 md:col-span-2 space-y-2">
                <label className="text-sm font-medium text-gray-700">تفاصيل الفندق</label>
                <div className="relative">
                  <FileText className="absolute right-3 top-3 text-gray-400" size={18} />
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50 focus:bg-white min-h-[100px] text-gray-900 placeholder:text-gray-400"
                    placeholder="وصف مختصر للفندق..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Amenities Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 border-b pb-2">
              <span className="w-1 h-5 bg-green-500 rounded-full"></span>
              المرافق والخدمات
            </h3>
            <div className="flex flex-wrap gap-3">
              {['واي فاي', 'مسبح', 'موقف سيارات', 'مطعم', 'كوفي شوب', 'خدمة غرف', 'جيم', 'سبا', 'قاعة اجتماعات'].map((amenity) => {
                const isSelected = formData.amenities.includes(amenity);
                return (
                  <button
                    key={amenity}
                    type="button"
                    onClick={() => toggleAmenity(amenity)}
                    className={`
                      relative px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2
                      ${isSelected 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200 translate-y-[-1px]' 
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-100'
                      }
                    `}
                  >
                    {isSelected && <Check size={14} className="animate-in fade-in zoom-in duration-200" />}
                    {amenity}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 sticky bottom-0 bg-white/95 backdrop-blur z-10">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-medium transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium flex items-center gap-2 shadow-lg shadow-blue-200 transition-all hover:shadow-xl hover:translate-y-[-1px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={18} />
              {loading ? 'جاري الحفظ...' : 'حفظ الفندق'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
