'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Plus, User, Check, X, Loader2, UserPlus, ChevronDown } from 'lucide-react';
import { countries } from '@/constants/countries';

const bookingPlatforms = [
  'Booking.com',
  'Agoda',
  'Airbnb',
  'Expedia',
  'Hotels.com',
  'Trip.com',
  'Google Hotels',
  'Gathern (جاذر إن)',
  'Almatar (المطار)',
  'Almosafer (المسافر)',
  'Ego (إيجو)',
  'Holidays (عطلات)',
  'Flynas',
  'Saudia Holidays',
  'MyTable',
  'HungerStation',
  'Jahez',
  'Other (أخرى)'
];

export interface Customer {
  id: string;
  full_name: string;
  national_id?: string;
  phone: string;
  customer_type: 'individual' | 'company' | 'broker' | 'platform';
  nationality?: string;
  email?: string;
  address?: string;
  details?: string;
  commercial_register?: string;
  tax_number?: string;
  company_name?: string;
  broker_name?: string;
  broker_id?: string;
  platform_name?: string;
  created_at: string;
}

interface CustomerStepProps {
  onNext: (customer: Customer) => void;
  initialCustomer?: Customer;
}

export const CustomerStep: React.FC<CustomerStepProps> = ({ onNext, initialCustomer }) => {
  // Supabase client is imported globally
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(initialCustomer || null);
  const [isCreating, setIsCreating] = useState(false);
  
  // New Customer Form State
  const [formData, setFormData] = useState<Partial<Customer>>({
    customer_type: 'individual',
    nationality: 'Saudi Arabia'
  });
  const [saving, setSaving] = useState(false);

  // Nationality Combobox State
  const [nationalityQuery, setNationalityQuery] = useState('');
  const [isNationalityOpen, setIsNationalityOpen] = useState(false);
  const nationalityWrapperRef = useRef<HTMLDivElement>(null);

  // Initialize nationality query when creating
  useEffect(() => {
    if (isCreating) {
      setNationalityQuery(formData.nationality || '');
    }
  }, [isCreating]);

  // Handle click outside nationality dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (nationalityWrapperRef.current && !nationalityWrapperRef.current.contains(event.target as Node)) {
        setIsNationalityOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredCountries = countries.filter(country => 
    country.name_ar.includes(nationalityQuery) || 
    country.name_en.toLowerCase().includes(nationalityQuery.toLowerCase())
  );

  // Search Effect
  useEffect(() => {
    const searchCustomers = async () => {
      if (!searchQuery.trim()) {
        setCustomers([]);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(`full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,national_id.ilike.%${searchQuery}%`)
        .limit(5);

      if (!error && data) {
        setCustomers(data);
      }
      setLoading(false);
    };

    const timeoutId = setTimeout(searchCustomers, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, supabase]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.phone) return;

    setSaving(true);
    const { data, error } = await supabase
      .from('customers')
      .insert([formData])
      .select()
      .single();

    if (!error && data) {
      setSelectedCustomer(data);
      setIsCreating(false);
      // Optional: onNext(data); // Auto advance? Maybe better to let user review then click next.
    } else {
      console.error('Error creating customer:', JSON.stringify(error, null, 2));
      alert(`حدث خطأ أثناء إضافة العميل: ${error?.message || 'خطأ غير معروف'}`);
    }
    setSaving(false);
  };

  const handleSmartCreate = () => {
    const query = searchQuery.trim();
    // Check if query contains only digits
    const isDigits = /^\d+$/.test(query);
    const newFormData: Partial<Customer> = { 
      ...formData,
      customer_type: 'individual',
      nationality: 'Saudi Arabia'
    };

    if (isDigits) {
      if (query.startsWith('05')) {
        newFormData.phone = query;
      } else if (query.length === 10) {
        newFormData.national_id = query;
      } else {
        newFormData.phone = query; // Default to phone for other numbers
      }
    } else {
      newFormData.full_name = query;
    }

    setFormData(newFormData);
    // If we have a name, we might want to reset nationality query if it was set before
    if (newFormData.nationality) {
        setNationalityQuery(newFormData.nationality);
    }
    setIsCreating(true);
  };

  if (selectedCustomer && !isCreating) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
        <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
              <User size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">{selectedCustomer.full_name}</h3>
              <div className="flex gap-3 text-xs text-gray-600 mt-0.5">
                <span className="font-medium">{selectedCustomer.phone}</span>
                <span className="text-gray-300">•</span>
                <span>{selectedCustomer.national_id || 'لا يوجد هوية'}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setSelectedCustomer(null)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => onNext(selectedCustomer)}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-200 text-sm"
          >
            <span>التالي: اختيار الوحدة</span>
            <Check size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isCreating ? (
        <>
          <div className="relative group max-w-2xl mx-auto">
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors">
              <Search size={20} />
            </div>
            <input
              type="text"
              placeholder="ابحث بالاسم، رقم الجوال، أو رقم الهوية..."
              className="w-full pl-4 pr-12 py-3 border-2 border-gray-100 rounded-xl text-base font-medium text-gray-900 placeholder:text-gray-400 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {loading && (
              <div className="absolute left-4 top-1/2 -translate-y-1/2 bg-white p-1 rounded-full shadow-sm">
                <Loader2 className="animate-spin text-blue-600" size={20} />
              </div>
            )}
          </div>

          <div className="space-y-2 max-w-2xl mx-auto">
            {customers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => setSelectedCustomer(customer)}
                className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-blue-50/50 hover:border-blue-200 cursor-pointer transition-all group shadow-sm hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                    <User size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-base group-hover:text-blue-700 transition-colors">{customer.full_name}</div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span className="flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-gray-300 group-hover:bg-blue-400"></span>
                        {customer.phone}
                      </span>
                      {customer.national_id && (
                        <span className="flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-gray-300 group-hover:bg-blue-400"></span>
                          {customer.national_id}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="px-3 py-1.5 bg-gray-50 text-gray-400 rounded-lg text-xs font-medium group-hover:bg-blue-100 group-hover:text-blue-700 transition-all">
                  اختيار
                </div>
              </div>
            ))}

            {customers.length === 0 && searchQuery && !loading && (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm mb-4">لا توجد نتائج مطابقة لـ "{searchQuery}"</p>
                <button
                  onClick={handleSmartCreate}
                  className="px-6 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition-all flex items-center gap-2 mx-auto"
                >
                  <UserPlus size={18} />
                  <span>تسجيل "{searchQuery}" كعميل جديد</span>
                </button>
              </div>
            )}
          </div>

          <div className="pt-4 border-t max-w-2xl mx-auto">
            <button
              onClick={() => setIsCreating(true)}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-medium hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Plus size={18} />
              <span>تسجيل عميل جديد</span>
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={handleCreateCustomer} className="max-w-3xl mx-auto bg-white border border-gray-100 rounded-2xl p-5 shadow-lg shadow-gray-100/50 animate-in zoom-in-95 duration-300">
          <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-6">
            <h3 className="text-base font-bold flex items-center gap-2 text-gray-800">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                <UserPlus size={18} />
              </div>
              بيانات العميل الجديد
            </h3>
            <button 
              type="button" 
              onClick={() => setIsCreating(false)}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">نوع العميل</label>
              <select
                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-bold text-gray-900 bg-white"
                value={formData.customer_type}
                onChange={e => {
                  const newType = e.target.value as any;
                  setFormData(prev => ({
                    ...prev, 
                    customer_type: newType,
                    full_name: newType === 'platform' ? '' : prev.full_name,
                    national_id: newType === 'platform' ? '' : prev.national_id,
                    nationality: newType === 'platform' ? '' : prev.nationality
                  }));
                }}
              >
                <option value="individual">فرد</option>
                <option value="company">شركة</option>
                <option value="broker">وسيط</option>
                <option value="platform">منصة حجز</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">الاسم الكامل <span className="text-red-500">*</span></label>
              <input
                required
                type="text"
                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-normal"
                value={formData.full_name || ''}
                onChange={e => setFormData({...formData, full_name: e.target.value})}
                placeholder="الاسم الثلاثي"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">رقم الجوال <span className="text-red-500">*</span></label>
              <input
                required
                type="tel"
                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-normal text-left"
                dir="ltr"
                placeholder="05xxxxxxxx"
                value={formData.phone || ''}
                onChange={e => setFormData({...formData, phone: e.target.value})}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">رقم الهوية / الإقامة</label>
              <input
                type="text"
                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-normal"
                value={formData.national_id || ''}
                onChange={e => setFormData({...formData, national_id: e.target.value})}
                placeholder="1xxxxxxxx / 2xxxxxxxx"
              />
            </div>

            <div className="space-y-1.5" ref={nationalityWrapperRef}>
              <label className="text-xs font-bold text-gray-700">الجنسية</label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-normal"
                  value={nationalityQuery}
                  onChange={e => {
                    setNationalityQuery(e.target.value);
                    setFormData({...formData, nationality: e.target.value});
                    setIsNationalityOpen(true);
                  }}
                  onFocus={() => setIsNationalityOpen(true)}
                  placeholder="ابحث عن الدولة..."
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <ChevronDown size={16} />
                </div>
                
                {isNationalityOpen && filteredCountries.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {filteredCountries.map((country) => (
                      <div
                        key={country.code}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-gray-700 hover:text-blue-700 flex items-center justify-between group"
                        onClick={() => {
                          setNationalityQuery(country.name_ar);
                          setFormData({...formData, nationality: country.name_ar});
                          setIsNationalityOpen(false);
                        }}
                      >
                        <span className="font-medium">{country.name_ar}</span>
                        <span className="text-xs text-gray-400 group-hover:text-blue-400">{country.name_en}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">البريد الإلكتروني</label>
              <input
                type="email"
                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-normal text-left"
                value={formData.email || ''}
                onChange={e => setFormData({...formData, email: e.target.value})}
                placeholder="example@mail.com"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">العنوان</label>
              <input
                type="text"
                className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-normal"
                value={formData.address || ''}
                onChange={e => setFormData({...formData, address: e.target.value})}
                placeholder="المدينة - الحي"
              />
            </div>
          </div>
          {formData.customer_type === 'individual' && (
            <div className="mt-4 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="text-xs font-bold text-gray-700">تفاصيل إضافية (المرافقين، العائلة، إلخ)</label>
              <textarea
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-normal h-24 resize-none"
                value={formData.details || ''}
                onChange={e => setFormData({...formData, details: e.target.value})}
                placeholder="اكتب هنا أسماء المرافقين (الزوجة، الأولاد) أو أي ملاحظات تشغيلية أخرى..."
              />
            </div>
          )}

          {formData.customer_type === 'company' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">السجل التجاري</label>
                <input
                  type="text"
                  className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-normal"
                  value={formData.commercial_register || ''}
                  onChange={e => setFormData({...formData, commercial_register: e.target.value})}
                  placeholder="رقم السجل التجاري"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">اسم الشركة</label>
                <input
                  type="text"
                  className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-normal"
                  value={formData.company_name || ''}
                  onChange={e => setFormData({...formData, company_name: e.target.value})}
                  placeholder="اسم الشركة الكامل"
                />
              </div>
            </div>
          )}

          {formData.customer_type === 'broker' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">اسم الوسيط</label>
                <input
                  type="text"
                  className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-normal"
                  value={formData.broker_name || ''}
                  onChange={e => setFormData({...formData, broker_name: e.target.value})}
                  placeholder="اسم الوسيط"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">رقم هوية الوسيط</label>
                <input
                  type="text"
                  className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-normal"
                  value={formData.broker_id || ''}
                  onChange={e => setFormData({...formData, broker_id: e.target.value})}
                  placeholder="رقم الهوية الوطنية للوسيط"
                />
              </div>
            </div>
          )}

          {formData.customer_type === 'platform' && (
            <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">منصة الحجز</label>
                <div className="relative">
                  <select
                    className="w-full p-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm font-bold text-gray-900 appearance-none bg-white"
                    value={formData.platform_name || ''}
                    onChange={e => setFormData({...formData, platform_name: e.target.value})}
                  >
                    <option value="">اختر المنصة...</option>
                    {bookingPlatforms.map(platform => (
                      <option key={platform} value={platform}>{platform}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 mt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-200 transition-all"
            >
              {saving && <Loader2 className="animate-spin" size={16} />}
              حفظ العميل
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
