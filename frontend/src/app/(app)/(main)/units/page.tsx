'use client';

import React, { useState, useEffect } from 'react';
import { Building2, Box, Layers, Plus, Search, Filter, Home, BedDouble, AlertCircle, MapPin, Phone, Calendar, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import HotelModal from '@/components/units/HotelModal';
import UnitTypeModal from '@/components/units/UnitTypeModal';
import UnitGeneratorModal from '@/components/units/UnitGeneratorModal';

interface Unit {
  id: string;
  unit_number: string;
  floor: string;
  status: string;
  hotel: { name: string };
  unit_type: { name: string };
}

interface Hotel {
  id: string;
  name: string;
  type: string;
  phone: string;
  address: string;
  description: string;
}

interface UnitType {
  daily_price: any;
  annual_price: any;
  max_children: any;
  max_adults: any;
  id: string;
  name: string;
  description: string;
  price_per_night: number;
  price_per_year: number;
  area: number;
  max_occupancy: number;
  hotel: { name: string };
}

type TabType = 'units' | 'hotels' | 'unit_types';

export default function UnitsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('units');
  
  // Data States
  const [units, setUnits] = useState<Unit[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Stats
  const [stats, setStats] = useState({
    hotels: 0,
    unitTypes: 0,
    units: 0
  });

  // Modals State
  const [showHotelModal, setShowHotelModal] = useState(false);
  const [showUnitTypeModal, setShowUnitTypeModal] = useState(false);
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  
  const [selectedUnitType, setSelectedUnitType] = useState<UnitType | null>(null);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]); // Refetch when tab changes to ensure fresh data

  const fetchData = async () => {
    setLoading(true);
    await fetchStats();
    
    if (activeTab === 'units') await fetchUnits();
    else if (activeTab === 'hotels') await fetchHotels();
    else if (activeTab === 'unit_types') await fetchUnitTypes();
    
    setLoading(false);
  };

  const fetchStats = async () => {
    const { count: hotelCount } = await supabase.from('hotels').select('*', { count: 'exact', head: true });
    const { count: typeCount } = await supabase.from('unit_types').select('*', { count: 'exact', head: true });
    const { count: unitCount } = await supabase.from('units').select('*', { count: 'exact', head: true });
    
    setStats({
      hotels: hotelCount || 0,
      unitTypes: typeCount || 0,
      units: unitCount || 0
    });
  };

  const fetchHotels = async () => {
    const { data } = await supabase
      .from('hotels')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (data) setHotels(data);
  };

  const fetchUnitTypes = async () => {
    const { data } = await supabase
      .from('unit_types')
      .select('*, hotel:hotels(name)')
      .order('created_at', { ascending: false });
      
    if (data) {
        const mappedTypes = data.map((t: any) => ({
            ...t,
            hotel: { name: t.hotel?.name || '-' }
        }));
        setUnitTypes(mappedTypes);
    }
  };

  const fetchUnits = async () => {
    const { data } = await supabase
      .from('units')
      .select(`
        id,
        unit_number,
        floor,
        status,
        hotel:hotels(name),
        unit_type:unit_types(name)
      `)
      .order('hotel_id')
      .order('floor')
      .order('unit_number');
    
    if (data) {
        const mappedUnits = data.map((u: any) => ({
            id: u.id,
            unit_number: u.unit_number,
            floor: u.floor,
            status: u.status,
            hotel: { name: u.hotel?.name || '-' },
            unit_type: { name: u.unit_type?.name || '-' }
        }));
        setUnits(mappedUnits);
    }
  };

  const getFilteredData = () => {
    if (activeTab === 'units') {
      return units.filter(u => 
        u.unit_number.includes(search) || 
        u.hotel.name.includes(search) || 
        u.unit_type.name.includes(search)
      );
    } else if (activeTab === 'hotels') {
      return hotels.filter(h => 
        h.name.includes(search) || 
        (h.phone && h.phone.includes(search)) ||
        (h.address && h.address.includes(search))
      );
    } else {
      return unitTypes.filter(t => 
        t.name.includes(search) || 
        t.hotel.name.includes(search)
      );
    }
  };

  const filteredData = getFilteredData();

  return (
    <div className="space-y-6 p-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Home className="text-blue-600" />
            إدارة الوحدات
          </h1>
          <p className="text-gray-500 mt-1">إدارة الفنادق، نماذج الوحدات، وتوليد الوحدات الجديدة</p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <button 
                onClick={() => setShowHotelModal(true)}
                className="flex-1 md:flex-none justify-center px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 hover:text-blue-600 hover:border-blue-200 transition-all font-medium flex items-center gap-2 shadow-sm"
            >
                <Building2 size={18} />
                <span>فندق جديد</span>
            </button>
            <button 
                onClick={() => setShowUnitTypeModal(true)}
                className="flex-1 md:flex-none justify-center px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 hover:text-purple-600 hover:border-purple-200 transition-all font-medium flex items-center gap-2 shadow-sm"
            >
                <Box size={18} />
                <span>نموذج جديد</span>
            </button>
            <button 
                onClick={() => setShowGeneratorModal(true)}
                className="flex-1 md:flex-none justify-center px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 shadow-md shadow-blue-200"
            >
                <Layers size={18} />
                <span>توليد وحدات</span>
            </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div 
          onClick={() => setActiveTab('hotels')}
          className={`cursor-pointer p-5 rounded-xl border shadow-sm flex items-center justify-between group transition-all ${
            activeTab === 'hotels' ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' : 'bg-white border-gray-100 hover:border-blue-200'
          }`}
        >
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">إجمالي الفنادق</p>
                <h3 className="text-3xl font-bold text-gray-900">{stats.hotels}</h3>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${
               activeTab === 'hotels' ? 'bg-blue-100 text-blue-600' : 'bg-blue-50 text-blue-600' 
            }`}>
                <Building2 size={24} />
            </div>
        </div>
        
        <div 
          onClick={() => setActiveTab('unit_types')}
          className={`cursor-pointer p-5 rounded-xl border shadow-sm flex items-center justify-between group transition-all ${
            activeTab === 'unit_types' ? 'bg-purple-50 border-purple-200 ring-1 ring-purple-300' : 'bg-white border-gray-100 hover:border-purple-200'
          }`}
        >
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">نماذج الوحدات</p>
                <h3 className="text-3xl font-bold text-gray-900">{stats.unitTypes}</h3>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${
                activeTab === 'unit_types' ? 'bg-purple-100 text-purple-600' : 'bg-purple-50 text-purple-600'
            }`}>
                <Box size={24} />
            </div>
        </div>

        <div 
          onClick={() => setActiveTab('units')}
          className={`cursor-pointer p-5 rounded-xl border shadow-sm flex items-center justify-between group transition-all ${
            activeTab === 'units' ? 'bg-green-50 border-green-200 ring-1 ring-green-300' : 'bg-white border-gray-100 hover:border-green-200'
          }`}
        >
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">إجمالي الوحدات</p>
                <h3 className="text-3xl font-bold text-gray-900">{stats.units}</h3>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${
                activeTab === 'units' ? 'bg-green-100 text-green-600' : 'bg-green-50 text-green-600'
            }`}>
                <BedDouble size={24} />
            </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 pt-2">
        <button
          onClick={() => setActiveTab('units')}
          className={`px-6 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'units' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
            الوحدات
        </button>
        <button
          onClick={() => setActiveTab('hotels')}
          className={`px-6 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'hotels' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
            الفنادق
        </button>
        <button
          onClick={() => setActiveTab('unit_types')}
          className={`px-6 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'unit_types' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
            نماذج الوحدات
        </button>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-b-xl rounded-tr-none border border-gray-200 shadow-sm overflow-hidden -mt-px">
        <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50/50">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                {activeTab === 'units' && <Layers size={20} className="text-gray-400" />}
                {activeTab === 'hotels' && <Building2 size={20} className="text-gray-400" />}
                {activeTab === 'unit_types' && <Box size={20} className="text-gray-400" />}
                {activeTab === 'units' ? 'قائمة الوحدات' : activeTab === 'hotels' ? 'قائمة الفنادق' : 'قائمة نماذج الوحدات'}
            </h3>
            <div className="flex gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-72">
                    <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="بحث..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-white text-gray-900"
                    />
                </div>
                <button className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors bg-white">
                    <Filter size={20} />
                </button>
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-right">
                <thead className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider">
                    {activeTab === 'units' && (
                        <tr>
                            <th className="px-6 py-4 font-medium">رقم الوحدة</th>
                            <th className="px-6 py-4 font-medium">الفندق</th>
                            <th className="px-6 py-4 font-medium">النموذج</th>
                            <th className="px-6 py-4 font-medium">الدور</th>
                            <th className="px-6 py-4 font-medium">الحالة</th>
                            <th className="px-6 py-4 font-medium">الإجراءات</th>
                        </tr>
                    )}
                    {activeTab === 'hotels' && (
                        <tr>
                            <th className="px-6 py-4 font-medium">اسم الفندق</th>
                            <th className="px-6 py-4 font-medium">النوع</th>
                            <th className="px-6 py-4 font-medium">العنوان</th>
                            <th className="px-6 py-4 font-medium">الهاتف</th>
                            <th className="px-6 py-4 font-medium">الإجراءات</th>
                        </tr>
                    )}
                    {activeTab === 'unit_types' && (
                        <tr>
                            <th className="px-6 py-4 font-medium">اسم النموذج</th>
                            <th className="px-6 py-4 font-medium">الفندق التابع</th>
                            <th className="px-6 py-4 font-medium">السعر اليومي</th>
                            <th className="px-6 py-4 font-medium">السعر السنوي</th>
                            <th className="px-6 py-4 font-medium">المساحة</th>
                            <th className="px-6 py-4 font-medium">السعة</th>
                            <th className="px-6 py-4 font-medium">الإجراءات</th>
                        </tr>
                    )}
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                    {loading ? (
                        [...Array(5)].map((_, i) => (
                            <tr key={i} className="animate-pulse">
                                <td colSpan={6} className="px-6 py-4">
                                    <div className="h-4 bg-gray-100 rounded w-3/4 mx-auto"></div>
                                </td>
                            </tr>
                        ))
                    ) : filteredData.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                                        <Search size={32} />
                                    </div>
                                    <p className="font-medium">لا توجد بيانات مطابقة</p>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        <>
                            {activeTab === 'units' && (filteredData as Unit[]).map((unit) => (
                                <tr key={unit.id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-6 py-4 font-bold text-gray-900 font-mono text-base">{unit.unit_number}</td>
                                    <td className="px-6 py-4 text-gray-700 font-medium">
                                        <div className="flex items-center gap-2">
                                            <Building2 size={14} className="text-gray-400" />
                                            {unit.hotel.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <Box size={14} className="text-gray-400" />
                                            {unit.unit_type.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 font-mono">{unit.floor}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                                            unit.status === 'available' ? 'bg-green-50 text-green-700 border-green-100' :
                                            unit.status === 'occupied' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                            'bg-gray-50 text-gray-700 border-gray-100'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${
                                                unit.status === 'available' ? 'bg-green-500' :
                                                unit.status === 'occupied' ? 'bg-blue-500' :
                                                'bg-gray-500'
                                            }`}></span>
                                            {unit.status === 'available' ? 'متاح' : 
                                             unit.status === 'occupied' ? 'مشغول' : unit.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button className="text-gray-400 hover:text-blue-600 font-medium text-xs transition-colors opacity-0 group-hover:opacity-100">
                                            تعديل
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {activeTab === 'hotels' && (filteredData as Hotel[]).map((hotel) => (
                                <tr key={hotel.id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-6 py-4 font-bold text-gray-900">{hotel.name}</td>
                                    <td className="px-6 py-4 text-gray-600">{hotel.type || '-'}</td>
                                    <td className="px-6 py-4 text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <MapPin size={14} className="text-gray-400" />
                                            {hotel.address || '-'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 font-mono" dir="ltr">
                                        <div className="flex items-center gap-2 justify-end">
                                            {hotel.phone}
                                            <Phone size={14} className="text-gray-400" />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button className="text-gray-400 hover:text-blue-600 font-medium text-xs transition-colors opacity-0 group-hover:opacity-100">
                                            تعديل
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {activeTab === 'unit_types' && (filteredData as UnitType[]).map((type) => (
                                <tr key={type.id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-6 py-4 font-bold text-gray-900">{type.name}</td>
                                    <td className="px-6 py-4 text-gray-600">{type.hotel.name}</td>
                                    <td className="px-6 py-4 text-gray-600 font-mono">
                                        {type.daily_price?.toLocaleString()} SAR
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 font-mono">
                                        {type.annual_price?.toLocaleString()} SAR
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {type.area ? `${type.area} م²` : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {type.max_adults ? `${type.max_adults} بالغين` : '-'}
                                        {type.max_children ? `, ${type.max_children} أطفال` : ''}
                                    </td>
                                    <td className="px-6 py-4">
                                        <button 
                                            onClick={() => {
                                                setSelectedUnitType(type);
                                                setShowUnitTypeModal(true);
                                            }}
                                            className="text-gray-400 hover:text-blue-600 font-medium text-xs transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            تعديل
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </>
                    )}
                </tbody>
            </table>
        </div>
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center">
            <span>عرض {filteredData.length} سجل</span>
            <div className="flex gap-2">
                <button className="px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-50" disabled>السابق</button>
                <button className="px-2 py-1 rounded hover:bg-gray-200 disabled:opacity-50" disabled>التالي</button>
            </div>
        </div>
      </div>

      {/* Modals */}
      <HotelModal 
        isOpen={showHotelModal} 
        onClose={() => {
            setShowHotelModal(false);
            setSelectedHotel(null);
        }} 
        onSuccess={() => {
            fetchStats();
            if (activeTab === 'hotels') fetchHotels();
            setShowHotelModal(false);
            setSelectedHotel(null);
        }} 
        initialData={selectedHotel}
      />
      <UnitTypeModal 
        isOpen={showUnitTypeModal} 
        onClose={() => {
            setShowUnitTypeModal(false);
            setSelectedUnitType(null);
        }} 
        onSuccess={() => {
            fetchStats();
            if (activeTab === 'unit_types') fetchUnitTypes();
            setShowUnitTypeModal(false);
            setSelectedUnitType(null);
        }} 
        initialData={selectedUnitType}
      />
      <UnitGeneratorModal 
        isOpen={showGeneratorModal} 
        onClose={() => setShowGeneratorModal(false)} 
        onSuccess={() => {
            fetchStats();
            if (activeTab === 'units') fetchUnits();
            setShowGeneratorModal(false);
        }} 
      />
    </div>
  );
}
