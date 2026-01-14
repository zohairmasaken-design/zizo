'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Layers, RefreshCw, List, Settings, ArrowRight, CheckCircle2, Building, Grid3X3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface UnitGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface Hotel {
  id: string;
  name: string;
}

interface UnitType {
  id: string;
  name: string;
}

interface GeneratedUnit {
  unit_number: string;
  floor: string;
  unit_type_id: string;
  status: string;
}

export default function UnitGeneratorModal({ isOpen, onClose, onSuccess }: UnitGeneratorModalProps) {
  const [loading, setLoading] = useState(false);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  const [generatedUnits, setGeneratedUnits] = useState<GeneratedUnit[]>([]);
  
  const [formData, setFormData] = useState({
    hotel_id: '',
    unit_type_id: '',
    start_floor: 1,
    end_floor: 1,
    units_per_floor: 10,
    numbering_style: 'floor_prefix', // floor_prefix (101), sequential (1,2,3)
    start_index: 1,
    auto_continue: true, // Check DB for last number
    view_type: '',
    notes: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchHotels();
    }
  }, [isOpen]);

  useEffect(() => {
    if (formData.hotel_id) {
      fetchUnitTypes(formData.hotel_id);
    }
  }, [formData.hotel_id]);

  const fetchHotels = async () => {
    const { data } = await supabase.from('hotels').select('id, name');
    if (data) setHotels(data);
  };

  const fetchUnitTypes = async (hotelId: string) => {
    const { data } = await supabase.from('unit_types').select('id, name').eq('hotel_id', hotelId);
    if (data) setUnitTypes(data);
  };

  const generatePreview = async () => {
    if (!formData.hotel_id || !formData.unit_type_id) {
        alert('الرجاء اختيار الفندق ونموذج الوحدة');
        return;
    }

    setLoading(true);
    const newUnits: GeneratedUnit[] = [];

    try {
        for (let floor = formData.start_floor; floor <= formData.end_floor; floor++) {
            let startIdx = formData.start_index;

            // Auto-continue logic: Fetch max unit number for this floor if enabled
            if (formData.auto_continue) {
                // This is a simplified check. Ideally, we parse the unit_number.
                // Assuming standard format like "105" for floor 1.
                // We'll search for unit numbers starting with the floor string
                const { data: existingUnits } = await supabase
                    .from('units')
                    .select('unit_number')
                    .eq('hotel_id', formData.hotel_id)
                    .eq('floor', floor.toString());

                if (existingUnits && existingUnits.length > 0) {
                    // Extract suffixes
                    const suffixes = existingUnits.map(u => {
                        // Remove floor prefix if style is floor_prefix
                        if (formData.numbering_style === 'floor_prefix') {
                            const prefix = floor.toString();
                            if (u.unit_number.startsWith(prefix)) {
                                return parseInt(u.unit_number.substring(prefix.length)) || 0;
                            }
                        }
                        return 0; // Fallback
                    });
                    const maxSuffix = Math.max(...suffixes, 0);
                    if (maxSuffix > 0) startIdx = maxSuffix + 1;
                }
            }

            for (let i = 0; i < formData.units_per_floor; i++) {
                const idx = startIdx + i;
                let unitNum = '';
                
                if (formData.numbering_style === 'floor_prefix') {
                    // e.g., Floor 1, Index 1 -> 101. Floor 10, Index 1 -> 1001? Or 1001.
                    // Usually Pad with 0 if index < 10
                    const idxStr = idx < 10 ? `0${idx}` : `${idx}`;
                    unitNum = `${floor}${idxStr}`;
                } else {
                    unitNum = `${idx}`; // Pure sequential, ignoring floor prefix logic here (user might want manual)
                }

                newUnits.push({
                    unit_number: unitNum,
                    floor: floor.toString(),
                    unit_type_id: formData.unit_type_id,
                    status: 'available'
                });
            }
        }
        setGeneratedUnits(newUnits);
    } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء إنشاء المعاينة');
    } finally {
        setLoading(false);
    }
  };

  const handleSave = async () => {
    if (generatedUnits.length === 0) return;
    setLoading(true);

    try {
        const payload = generatedUnits.map(u => ({
            hotel_id: formData.hotel_id,
            unit_type_id: u.unit_type_id,
            unit_number: u.unit_number,
            floor: u.floor,
            status: u.status,
            view_type: formData.view_type, // Suggestion
            notes: formData.notes
        }));

        const { error } = await supabase.from('units').insert(payload);
        if (error) throw error;

        onSuccess();
        onClose();
    } catch (error) {
        console.error(error);
        alert('حدث خطأ أثناء حفظ الوحدات');
    } finally {
        setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 rounded-xl text-purple-600 shadow-sm ring-1 ring-purple-100">
              <Layers size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">منشئ الوحدات الذكي (Bulk Generator)</h2>
              <p className="text-sm text-gray-500 mt-1">توليد مئات الوحدات بضغطة زر واحدة وفق منطق ذكي</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content - Two Column Layout */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
            
            {/* Left Sidebar: Configuration */}
            <div className="w-full lg:w-[450px] bg-gray-50/50 border-l border-gray-100 p-6 overflow-y-auto custom-scrollbar">
                <div className="space-y-8">
                    
                    {/* Section 1: Target */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Building size={16} className="text-purple-600" />
                            الهدف
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-600">الفندق</label>
                                <select
                                    value={formData.hotel_id}
                                    onChange={e => setFormData({...formData, hotel_id: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white text-gray-900"
                                >
                                    <option value="">اختر الفندق...</option>
                                    {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-gray-600">نموذج الوحدة</label>
                                <select
                                    value={formData.unit_type_id}
                                    onChange={e => setFormData({...formData, unit_type_id: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white text-gray-900"
                                >
                                    <option value="">اختر النموذج...</option>
                                    {unitTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-gray-200"></div>

                    {/* Section 2: Floors & Numbers */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Grid3X3 size={16} className="text-purple-600" />
                            توزيع الأدوار
                        </h3>
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs text-gray-500">من دور</label>
                                    <input type="number" value={formData.start_floor} onChange={e => setFormData({...formData, start_floor: Number(e.target.value)})} className="w-full p-2 border rounded-lg text-gray-900" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs text-gray-500">إلى دور</label>
                                    <input type="number" value={formData.end_floor} onChange={e => setFormData({...formData, end_floor: Number(e.target.value)})} className="w-full p-2 border rounded-lg text-gray-900" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs text-gray-500">عدد الوحدات في كل دور</label>
                                <input type="number" value={formData.units_per_floor} onChange={e => setFormData({...formData, units_per_floor: Number(e.target.value)})} className="w-full p-2 border rounded-lg font-bold text-center" />
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-gray-200"></div>

                    {/* Section 3: Numbering Logic */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            <Settings size={16} className="text-purple-600" />
                            منطق الترقيم
                        </h3>
                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 space-y-4">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <div className="relative flex items-center">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.auto_continue} 
                                        onChange={e => setFormData({...formData, auto_continue: e.target.checked})}
                                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-purple-300 bg-white transition-all checked:border-purple-600 checked:bg-purple-600"
                                    />
                                    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                                        <CheckCircle2 size={12} />
                                    </div>
                                </div>
                                <div className="text-xs">
                                    <span className="font-bold text-purple-900 block mb-0.5">إكمال الترقيم الذكي</span>
                                    <span className="text-purple-700">يقوم النظام بفحص آخر رقم وحدة في الدور وإكمال الترقيم بعده تلقائياً</span>
                                </div>
                            </label>
                            
                            <div className={`space-y-3 transition-opacity duration-200 ${formData.auto_continue ? 'opacity-50 pointer-events-none' : ''}`}>
                                 <div className="space-y-1.5">
                                    <label className="text-xs text-gray-500">يبدأ الترقيم من (Index)</label>
                                    <input type="number" value={formData.start_index} onChange={e => setFormData({...formData, start_index: Number(e.target.value)})} className="w-full p-2 border rounded-lg bg-white" />
                                 </div>
                            </div>

                            <div className="space-y-1.5">
                                 <label className="text-xs text-gray-500">نمط الترقيم</label>
                                 <select value={formData.numbering_style} onChange={e => setFormData({...formData, numbering_style: e.target.value})} className="w-full p-2 border rounded-lg bg-white text-gray-900">
                                    <option value="floor_prefix">رقم الدور + التسلسل (مثال: 101)</option>
                                    <option value="sequential">تسلسل بسيط (مثال: 1, 2, 3)</option>
                                 </select>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={generatePreview}
                        disabled={loading}
                        className="w-full py-4 bg-gray-900 text-white rounded-xl hover:bg-gray-800 font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
                    >
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                        توليد المعاينة
                    </button>
                </div>
            </div>

            {/* Right Area: Preview */}
            <div className="flex-1 bg-white flex flex-col min-h-0">
                <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <List size={20} className="text-gray-500" />
                        معاينة الوحدات المقترحة 
                        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs">{generatedUnits.length} وحدة</span>
                    </h3>
                    {generatedUnits.length > 0 && (
                        <button onClick={() => setGeneratedUnits([])} className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-1 hover:bg-red-50 rounded-lg transition-colors">
                            مسح القائمة
                        </button>
                    )}
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
                    {generatedUnits.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                            <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center">
                                <Layers size={48} className="opacity-20" />
                            </div>
                            <div className="text-center">
                                <p className="font-medium text-gray-600">القائمة فارغة</p>
                                <p className="text-sm">قم بضبط الإعدادات واضغط على "توليد المعاينة"</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {generatedUnits.map((u, i) => (
                                <div key={i} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center justify-center text-center group relative">
                                    <div className="text-xs text-gray-400 mb-1">دور {u.floor}</div>
                                    <div className="font-bold text-xl text-gray-900 font-mono tracking-tight group-hover:text-purple-600 transition-colors">{u.unit_number}</div>
                                    <div className="mt-2 w-full h-1 bg-green-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500 w-full"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t bg-white">
                    <button
                        onClick={handleSave}
                        disabled={loading || generatedUnits.length === 0}
                        className="w-full py-3.5 bg-green-600 text-white rounded-xl hover:bg-green-700 font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-200 transition-all hover:translate-y-[-2px]"
                    >
                        <Save size={20} />
                        تأكيد وحفظ {generatedUnits.length} وحدة في قاعدة البيانات
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
