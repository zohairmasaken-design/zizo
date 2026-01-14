'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Save, User, Building2, Globe, Briefcase, ChevronDown, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { countries } from '@/constants/countries';

export type CustomerType = 'individual' | 'company' | 'broker' | 'platform';

export interface Customer {
  id: string;
  full_name: string;
  customer_type: CustomerType;
  phone?: string;
  email?: string;
  national_id?: string;
  nationality?: string;
  commercial_register?: string;
  tax_number?: string;
  address?: string;
  details?: string;
  created_at?: string;
}

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customerToEdit?: Customer | null;
}

const CUSTOMER_TYPES: { id: CustomerType; label: string; icon: any }[] = [
  { id: 'individual', label: 'فرد', icon: User },
  { id: 'company', label: 'شركة', icon: Building2 },
  { id: 'platform', label: 'منصة حجز', icon: Globe },
  { id: 'broker', label: 'وسيط', icon: Briefcase },
];

export function CustomerModal({ isOpen, onClose, onSuccess, customerToEdit }: CustomerModalProps) {
  const [formData, setFormData] = useState<Partial<Customer>>({
    customer_type: 'individual',
    nationality: 'Saudi Arabia',
    full_name: '',
    phone: '',
    national_id: '',
    email: '',
    address: '',
    commercial_register: '',
    tax_number: '',
    details: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Nationality State
  const [nationalityQuery, setNationalityQuery] = useState('');
  const [isNationalityOpen, setIsNationalityOpen] = useState(false);
  const nationalityWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (customerToEdit) {
      setFormData(customerToEdit);
      setNationalityQuery(customerToEdit.nationality || 'Saudi Arabia');
    } else {
      setFormData({
        customer_type: 'individual',
        nationality: 'Saudi Arabia',
        full_name: '',
        phone: '',
        national_id: '',
        email: '',
        address: '',
        commercial_register: '',
        tax_number: '',
        details: ''
      });
      setNationalityQuery('Saudi Arabia');
    }
    setError(null);
  }, [customerToEdit, isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (nationalityWrapperRef.current && !nationalityWrapperRef.current.contains(event.target as Node)) {
        setIsNationalityOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.full_name) throw new Error('الاسم مطلوب');
      if (formData.customer_type === 'individual' && !formData.phone) throw new Error('رقم الهاتف مطلوب للأفراد');

      const payload = {
        ...formData,
        nationality: formData.customer_type === 'individual' ? formData.nationality : null,
      };

      if (customerToEdit) {
        const { error: updateError } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', customerToEdit.id);
        
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('customers')
          .insert([payload]);
        
        if (insertError) throw insertError;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving customer:', err);
      setError(err.message || 'حدث خطأ أثناء حفظ البيانات');
    } finally {
      setLoading(false);
    }
  };

  const filteredCountries = countries.filter(country => 
    country.name_ar.includes(nationalityQuery) || 
    country.name_en.toLowerCase().includes(nationalityQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">
            {customerToEdit ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-sm">
              {error}
            </div>
          )}

          {/* Customer Type */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CUSTOMER_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setFormData({ ...formData, customer_type: type.id })}
                className={`
                  flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all
                  ${formData.customer_type === type.id
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-100 hover:border-blue-200 text-gray-600'
                  }
                `}
              >
                <type.icon size={24} />
                <span className="text-sm font-medium">{type.label}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Full Name */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {formData.customer_type === 'individual' ? 'الاسم الكامل' : 'اسم المنشأة / المنصة'}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={formData.full_name || ''}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder={formData.customer_type === 'individual' ? 'اسم العميل رباعي' : 'اسم الشركة أو المنصة'}
              />
            </div>

            {/* Individual Fields */}
            {formData.customer_type === 'individual' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهوية / الإقامة</label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    value={formData.national_id || ''}
                    onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                  />
                </div>

                <div className="relative" ref={nationalityWrapperRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الجنسية</label>
                  <div 
                    className="w-full p-3 border border-gray-200 rounded-xl flex justify-between items-center cursor-pointer hover:border-blue-400"
                    onClick={() => setIsNationalityOpen(!isNationalityOpen)}
                  >
                    <span>{formData.nationality || 'اختر الجنسية'}</span>
                    <ChevronDown size={16} className="text-gray-400" />
                  </div>
                  
                  {isNationalityOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto z-50">
                      <div className="p-2 sticky top-0 bg-white border-b">
                        <input
                          type="text"
                          className="w-full p-2 bg-gray-50 rounded-lg text-sm outline-none"
                          placeholder="بحث عن دولة..."
                          value={nationalityQuery}
                          onChange={(e) => setNationalityQuery(e.target.value)}
                          autoFocus
                        />
                      </div>
                      {filteredCountries.map((country) => (
                        <div
                          key={country.code}
                          className="px-4 py-2 hover:bg-blue-50 cursor-pointer flex justify-between items-center"
                          onClick={() => {
                            setFormData({ ...formData, nationality: country.name_ar });
                            setNationalityQuery(country.name_ar);
                            setIsNationalityOpen(false);
                          }}
                        >
                          <span className="flex items-center gap-2">
                            <span className="text-lg">{country.flag}</span>
                            <span>{country.name_ar}</span>
                          </span>
                          {formData.nationality === country.name_ar && <Check size={16} className="text-blue-600" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Common Fields */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف</label>
              <input
                type="tel"
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                dir="ltr"
              />
            </div>

            {/* Company Fields */}
            {formData.customer_type !== 'individual' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">السجل التجاري</label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    value={formData.commercial_register || ''}
                    onChange={(e) => setFormData({ ...formData, commercial_register: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">الرقم الضريبي</label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    value={formData.tax_number || ''}
                    onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">العنوان</label>
              <textarea
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all min-h-[80px]"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات عن العميل</label>
              <textarea
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all min-h-[80px]"
                value={formData.details || ''}
                onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                placeholder="ملاحظات داخلية عن العميل (عدد المرافقين، تفضيلات خاصة، إلخ)"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl text-gray-700 hover:bg-gray-50 font-medium transition-colors"
              disabled={loading}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save size={18} />
                  حفظ البيانات
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
