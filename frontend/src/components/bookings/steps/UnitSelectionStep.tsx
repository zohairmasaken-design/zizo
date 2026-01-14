import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { UnitType, PricingRule, calculateStayPrice, PriceCalculation } from '@/lib/pricing';
import { Calendar, Users, Info, Check, ArrowRight, Loader2, BedDouble, Ruler, Star } from 'lucide-react';
import { format, addDays, addMonths, differenceInCalendarDays, parseISO, isBefore, startOfToday } from 'date-fns';
import { arSA } from 'date-fns/locale';

import { Unit } from '../BookingWizard';

interface UnitSelectionStepProps {
  onNext: (data: { unitType: UnitType; unit: Unit; startDate: Date; endDate: Date; calculation: PriceCalculation; bookingType: 'daily' | 'yearly' }) => void;
  onBack: () => void;
  initialData?: {
    unitType?: UnitType;
    startDate?: Date;
    endDate?: Date;
    bookingType?: 'daily' | 'yearly';
  };
}

export const UnitSelectionStep: React.FC<UnitSelectionStepProps> = ({ onNext, onBack, initialData }) => {
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [startDate, setStartDate] = useState<string>(
    initialData?.startDate ? format(initialData.startDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState<string>(
    initialData?.endDate ? format(initialData.endDate, 'yyyy-MM-dd') : format(addDays(new Date(), 1), 'yyyy-MM-dd')
  );
  
  const [selectedType, setSelectedType] = useState<UnitType | null>(initialData?.unitType || null);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [loadingUnits, setLoadingUnits] = useState(false);

  const [bookingType, setBookingType] = useState<'daily' | 'yearly'>(initialData?.bookingType || 'daily');
  const [durationMonths, setDurationMonths] = useState<number>(12);
  
  useEffect(() => {
    if (bookingType === 'yearly' && startDate) {
      setEndDate(format(addMonths(parseISO(startDate), durationMonths), 'yyyy-MM-dd'));
    }
  }, [bookingType, startDate, durationMonths]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // Fetch Unit Types
      const { data: types, error: typesError } = await supabase
        .from('unit_types')
        .select('*');
        
      if (typesError) console.error('Error fetching unit types:', typesError);

      // Fetch Pricing Rules
      const { data: rules, error: rulesError } = await supabase
        .from('pricing_rules')
        .select('*')
        .eq('active', true);

      if (rulesError) console.error('Error fetching pricing rules:', rulesError);

      if (types) setUnitTypes(types);
      if (rules) setPricingRules(rules);
      
      setLoading(false);
    };

    fetchData();
  }, []);

  // Fetch available units when selectedType or dates change
  useEffect(() => {
    const fetchUnits = async () => {
      if (!selectedType || !startDate || !endDate) {
        setAvailableUnits([]);
        setSelectedUnit(null);
        return;
      }

      setLoadingUnits(true);
      setSelectedUnit(null);

      try {
        // 1. Fetch all units of this type
        const { data: units, error: unitsError } = await supabase
          .from('units')
          .select('*')
          .eq('unit_type_id', selectedType.id)
          .eq('status', 'available');

        if (unitsError) throw unitsError;

        if (!units || units.length === 0) {
          setAvailableUnits([]);
          setLoadingUnits(false);
          return;
        }

        // 2. Fetch bookings that overlap with requested dates
        // Overlap: (booking.check_in < req_end) AND (booking.check_out > req_start)
        const { data: bookings, error: bookingsError } = await supabase
          .from('bookings')
          .select('unit_id, units!inner(unit_type_id)')
          .eq('units.unit_type_id', selectedType.id)
          .in('status', ['confirmed', 'checked_in', 'pending_deposit'])
          .lt('check_in', endDate)
          .gt('check_out', startDate);

        if (bookingsError) throw bookingsError;

        // 3. Filter units
        const bookedUnitIds = new Set(bookings?.map(b => b.unit_id) || []);
        const available = units.filter(u => !bookedUnitIds.has(u.id));
        
        setAvailableUnits(available as unknown as Unit[]);
      } catch (err) {
        console.error('Error fetching units:', err);
      } finally {
        setLoadingUnits(false);
      }
    };

    fetchUnits();
  }, [selectedType, startDate, endDate]);

  const handleNext = () => {
    if (!selectedType || !selectedUnit || !startDate || !endDate) return;
    
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    // Validate dates
    if (isBefore(end, start) || differenceInCalendarDays(end, start) < 1) {
      alert('تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول');
      return;
    }

    let calculation: PriceCalculation;
    
    if (bookingType === 'yearly') {
        const annualPrice = selectedType.annual_price || 0;
        if (annualPrice === 0) {
            alert('عذراً، هذا النموذج لا يحتوي على سعر سنوي محدد');
            return;
        }
        
        // Calculate price based on number of months (Annual Price / 12 * Months)
        const monthlyRate = annualPrice / 12;
        const totalPrice = monthlyRate * durationMonths;
        
        calculation = {
            totalPrice: totalPrice,
            basePrice: annualPrice, // Keep original annual price as base
            nights: differenceInCalendarDays(end, start),
            breakdown: [{
                date: startDate,
                price: totalPrice,
                isSeason: false
            }]
        };
    } else {
        calculation = calculateStayPrice(selectedType, pricingRules, start, end);
    }
    
    onNext({
      unitType: selectedType,
      unit: selectedUnit,
      startDate: start,
      endDate: end,
      calculation,
      bookingType
    });
  };

  const getPriceDisplay = (type: UnitType) => {
    if (bookingType === 'yearly') {
        const annualPrice = type.annual_price || 0;
        const monthlyRate = annualPrice / 12;
        const totalPrice = monthlyRate * durationMonths;

        return (
            <div className="text-left">
                <div className="text-2xl font-bold text-blue-600">
                    {totalPrice > 0 ? totalPrice.toLocaleString() : '-'} <span className="text-sm font-normal text-gray-500">ريال</span>
                </div>
                <div className="text-xs text-gray-500">
                    {durationMonths} أشهر ({Math.round(monthlyRate).toLocaleString()} ريال/شهر)
                </div>
            </div>
        );
    }

    if (startDate && endDate) {
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      
      if (!isBefore(end, start) && differenceInCalendarDays(end, start) > 0) {
        const calc = calculateStayPrice(type, pricingRules, start, end);
        return (
          <div className="text-left">
            <div className="text-2xl font-bold text-blue-600">
              {calc.totalPrice.toLocaleString()} <span className="text-sm font-normal text-gray-500">ريال</span>
            </div>
            <div className="text-xs text-gray-500">
              {calc.nights} ليلة • {(calc.totalPrice / calc.nights).toFixed(0)} /ليلة
            </div>
          </div>
        );
      }
    }
    
    // Default display
    return (
      <div className="text-left">
        <div className="text-2xl font-bold text-gray-900">
          {type.daily_price?.toLocaleString() || '-'} <span className="text-sm font-normal text-gray-500">ريال</span>
        </div>
        <div className="text-xs text-gray-500">
          سعر الليلة الافتراضي
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={32} />
        <p className="text-gray-500">جاري تحميل الوحدات...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Date Selection */}
      <div className="space-y-4">
        <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
            <button
                onClick={() => setBookingType('daily')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                    bookingType === 'daily' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                حجز يومي
            </button>
            <button
                onClick={() => setBookingType('yearly')}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                    bookingType === 'yearly' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                حجز سنوي
            </button>
        </div>

        <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Calendar size={16} className="text-blue-600" />
              تاريخ الوصول
            </label>
            <input 
              type="date" 
              className="w-full p-3 border border-gray-200 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={startDate}
              min={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Calendar size={16} className="text-blue-600" />
              تاريخ المغادرة
            </label>
            <input 
              type="date" 
              className="w-full p-3 border border-gray-200 rounded-xl text-gray-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={endDate}
              min={startDate ? format(addDays(parseISO(startDate), 1), 'yyyy-MM-dd') : format(addDays(new Date(), 1), 'yyyy-MM-dd')}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={bookingType === 'yearly'}
            />
            {bookingType === 'yearly' && (
                <div className="mt-2 flex items-center gap-2">
                    <label className="text-xs font-bold text-gray-700 whitespace-nowrap">مدة العقد (أشهر):</label>
                    <input 
                        type="number" 
                        min="1" 
                        max="60" 
                        value={durationMonths}
                        onChange={(e) => setDurationMonths(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 p-2 text-center border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <span className="text-xs text-blue-600">
                        * يتم تحديث تاريخ المغادرة والسعر تلقائياً
                    </span>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Unit Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {unitTypes.map((type) => {
          const isSelected = selectedType?.id === type.id;
          return (
            <div 
              key={type.id}
              onClick={() => setSelectedType(type)}
              className={`
                relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 group
                ${isSelected 
                  ? 'border-blue-600 bg-blue-50/30 shadow-lg shadow-blue-100 scale-[1.02]' 
                  : 'border-gray-100 bg-white hover:border-blue-300 hover:shadow-md'
                }
              `}
            >
              {isSelected && (
                <div className="absolute -top-3 -right-3 bg-blue-600 text-white p-1.5 rounded-full shadow-lg">
                  <Check size={16} strokeWidth={3} />
                </div>
              )}

              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{type.name}</h3>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <BedDouble size={14} />
                      {type.features?.length || 0} مرافق
                    </span>
                    <span className="flex items-center gap-1">
                      <Ruler size={14} />
                      {type.area || '-'} م²
                    </span>
                  </div>
                </div>
                {getPriceDisplay(type)}
              </div>

              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-lg text-xs font-medium text-gray-600">
                  <Users size={12} />
                  <span>{type.max_adults} كبار</span>
                </div>
                <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-lg text-xs font-medium text-gray-600">
                  <Users size={12} />
                  <span>{type.max_children} أطفال</span>
                </div>
              </div>

              {type.features && type.features.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                  {type.features.slice(0, 3).map((feat, idx) => (
                    <span key={idx} className="text-[10px] bg-white border border-gray-200 px-2 py-1 rounded-full text-gray-500">
                      {feat}
                    </span>
                  ))}
                  {type.features.length > 3 && (
                    <span className="text-[10px] text-gray-400 px-1 py-1">
                      +{type.features.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Available Units Selection */}
      {selectedType && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-4 border-t">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-gray-900">الوحدات المتاحة</h3>
            <span className="text-sm text-gray-500 font-normal">
              ({availableUnits.length} وحدة متاحة من نوع {selectedType.name})
            </span>
          </div>

          {loadingUnits ? (
            <div className="flex justify-center py-8">
               <Loader2 className="animate-spin text-blue-600" size={24} />
            </div>
          ) : availableUnits.length === 0 ? (
            <div className="bg-red-50 text-red-600 p-6 rounded-xl text-center border border-red-100">
              لا توجد وحدات متاحة من هذا النوع في التواريخ المحددة.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {availableUnits.map((unit) => {
                 const isUnitSelected = selectedUnit?.id === unit.id;
                 return (
                   <div
                     key={unit.id}
                     onClick={() => setSelectedUnit(unit)}
                     className={`
                       cursor-pointer p-5 rounded-2xl border-2 transition-all text-center relative overflow-hidden group
                       ${isUnitSelected 
                         ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-lg transform scale-105' 
                         : 'border-gray-100 bg-white text-gray-700 hover:border-blue-300 hover:shadow-md'
                       }
                     `}
                   >
                     {/* Status Indicator */}
                     <div className="absolute top-3 right-3 flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                        <span className="text-[10px] font-bold text-emerald-600">متاح</span>
                     </div>

                     <div className="mt-2 font-bold text-3xl mb-2 tracking-tight">{unit.unit_number}</div>
                     <div className="text-xs text-gray-500 font-medium bg-gray-100/80 rounded-full px-3 py-1 inline-block">
                        الدور {unit.floor}
                     </div>
                   </div>
                 );
              })}
            </div>
          )}
        </div>
      )}

      {unitTypes.length === 0 && (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-2xl border border-dashed">
          لا توجد نماذج وحدات مضافة حالياً.
        </div>
      )}

      {/* Action Bar */}
      <div className="flex justify-between pt-6 border-t">
        <button
          onClick={onBack}
          className="text-gray-600 px-6 py-3 rounded-xl font-bold hover:bg-gray-100 transition-all flex items-center gap-2"
        >
          <ArrowRight size={20} />
          <span>رجوع</span>
        </button>

        <button
          onClick={handleNext}
          disabled={!selectedType || !selectedUnit || !startDate || !endDate}
          className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>التالي: تفاصيل السعر</span>
          <ArrowRight size={20} className="rotate-180" />
        </button>
      </div>
    </div>
  );
};
