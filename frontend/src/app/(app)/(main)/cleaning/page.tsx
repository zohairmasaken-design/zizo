'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Brush, 
  CheckCircle, 
  Filter, 
  BedDouble, 
  AlertCircle,
  Check,
  Camera,
  X,
  User,
  ClipboardList,
  Calendar,
  UserCheck,
  Search,
  MessageSquare,
  AlertTriangle,
  Award,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface Hotel {
  id: string;
  name: string;
}

interface UnitType {
  name: string;
}

interface Unit {
  id: string;
  unit_number: string;
  floor: string;
  status: 'available' | 'occupied' | 'maintenance' | 'cleaning';
  hotel_id: string;
  hotel?: Hotel;
  unit_type?: UnitType;
}

interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
}

interface CleaningLog {
  id: string;
  unit_id: string;
  cleaned_by: string;
  cleaned_at: string;
  notes?: string;
  photo_data?: string;
  unit?: {
    unit_number: string;
    hotel?: {
      name: string;
    };
  };
  cleaner_name?: string;
  status?: 'pending' | 'confirmed';
  confirmed_by?: string;
  confirmed_at?: string;
  confirmer_name?: string;
}

interface StaffNote {
  id: string;
  target_user_id: string;
  created_by: string;
  type: 'violation' | 'note' | 'commendation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  content: string;
  created_at: string;
  target_user_name?: string;
  creator_name?: string;
}

const STATUS_LABELS = {
  available: { label: 'متاح', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  occupied: { label: 'مشغول', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: BedDouble },
  maintenance: { label: 'صيانة', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle },
  cleaning: { label: 'تنظيف', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Brush },
};

export default function CleaningPage() {
  const [activeTab, setActiveTab] = useState<'needs_cleaning' | 'all' | 'history' | 'notes'>('needs_cleaning');
  const [selectedHotel, setSelectedHotel] = useState<string>('all');
  const [units, setUnits] = useState<Unit[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [cleaningLogs, setCleaningLogs] = useState<CleaningLog[]>([]);
  const [staffNotes, setStaffNotes] = useState<StaffNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [cleanerFilter, setCleanerFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Cleaning Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  
  // Note Modal State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteForm, setNoteForm] = useState<{
    target_user_id: string;
    type: 'violation' | 'note' | 'commendation';
    severity: 'low' | 'medium' | 'high' | 'critical';
    content: string;
  }>({
    target_user_id: '',
    type: 'note',
    severity: 'low',
    content: ''
  });
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [notes, setNotes] = useState('');
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Data
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
      fetchProfiles();
    } else if (activeTab === 'notes') {
      fetchNotes();
      fetchProfiles();
    } else {
      fetchData();
    }
    fetchCurrentUser();
  }, [activeTab]);

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*');
    if (data) setAllProfiles(data);
  };

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const { data: notesData, error } = await supabase
        .from('staff_notes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (notesData) {
        // Fetch profiles to map names
        // Since we fetch profiles separately, we can just map them later or ensure profiles are fetched.
        // For simplicity, let's just rely on fetchProfiles being called in parallel or ensure we have names.
        // Actually fetchProfiles runs in parallel. But we need to wait for profiles to map names?
        // Better to just fetch profiles first or here.
        
        // Let's get unique IDs from notes
        const userIds = new Set<string>();
        notesData.forEach(n => {
          userIds.add(n.target_user_id);
          userIds.add(n.created_by);
        });

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', Array.from(userIds));
          
        const profileMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p.full_name || 'مستخدم غير معروف';
          return acc;
        }, {} as Record<string, string>);

        const enrichedNotes = notesData.map(n => ({
          ...n,
          target_user_name: profileMap[n.target_user_id] || 'موظف غير معروف',
          creator_name: profileMap[n.created_by] || 'مستخدم غير معروف'
        }));

        setStaffNotes(enrichedNotes as StaffNote[]);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('cleaning_logs')
        .select(`
          *,
          unit:units(unit_number, hotel:hotels(name))
        `)
        .order('cleaned_at', { ascending: false });

      if (cleanerFilter !== 'all') {
        query = query.eq('cleaned_by', cleanerFilter);
      }
      
      if (dateFilter) {
        // Filter by date (ignoring time)
        const nextDay = new Date(dateFilter);
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.gte('cleaned_at', dateFilter).lt('cleaned_at', nextDay.toISOString().split('T')[0]);
      }

      const { data: logs, error } = await query;

      if (error) throw error;

      if (logs) {
        // Fetch cleaner and confirmer names
        const userIds = new Set<string>();
        logs.forEach(log => {
          if (log.cleaned_by) userIds.add(log.cleaned_by);
          if (log.confirmed_by) userIds.add(log.confirmed_by);
        });
        
        const uniqueUserIds = Array.from(userIds);
        let profileMap: Record<string, string> = {};
        
        if (uniqueUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', uniqueUserIds);
          
          profileMap = (profiles || []).reduce((acc, profile) => {
            acc[profile.id] = profile.full_name || 'مستخدم غير معروف';
            return acc;
          }, {} as Record<string, string>);
        }

        const logsWithNames = logs.map(log => ({
          ...log,
          cleaner_name: profileMap[log.cleaned_by] || 'مستخدم غير معروف',
          confirmer_name: log.confirmed_by ? (profileMap[log.confirmed_by] || 'مستخدم غير معروف') : undefined
        }));
        
        setCleaningLogs(logsWithNames);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [cleanerFilter, dateFilter]); // Re-fetch when filters change

  const handleConfirmLog = async (log: CleaningLog) => {
    if (!currentUser) return;
    if (!confirm('هل أنت متأكد من تأكيد هذا التنظيف؟ سيتم حذف الصورة وتسجيل التأكيد.')) return;

    try {
      // 1. Update cleaning_logs
      const { error } = await supabase
        .from('cleaning_logs')
        .update({
          status: 'confirmed',
          confirmed_by: currentUser.id,
          confirmed_at: new Date().toISOString(),
          photo_data: null // Delete photo to save space/privacy
        })
        .eq('id', log.id);

      if (error) throw error;

      // 2. Update local state
      setCleaningLogs(prev => prev.map(l => 
        l.id === log.id 
          ? { 
              ...l, 
              status: 'confirmed', 
              confirmed_by: currentUser.id, 
              confirmed_at: new Date().toISOString(),
              photo_data: undefined,
              confirmer_name: currentUser.user_metadata?.full_name || currentUser.email || 'أنا'
            } 
          : l
      ));

    } catch (error) {
      console.error('Error confirming log:', error);
      alert('حدث خطأ أثناء التأكيد');
    }
  };

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Fetch profile if exists, otherwise use auth data
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
        
      setCurrentUser({
        id: user.id,
        email: user.email || '',
        full_name: profile?.full_name
      });
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Hotels
      const { data: hotelsData } = await supabase
        .from('hotels')
        .select('id, name')
        .order('name');
      
      if (hotelsData) setHotels(hotelsData);

      // Fetch Units
      const { data: unitsData, error } = await supabase
        .from('units')
        .select(`
          id,
          unit_number,
          floor,
          status,
          hotel_id,
          hotel:hotels(id, name),
          unit_type:unit_types(name)
        `)
        .order('unit_number');

      if (error) throw error;
      if (unitsData) setUnits(unitsData as any);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Open Cleaning Modal
  const openCleaningModal = (unit: Unit) => {
    setSelectedUnit(unit);
    setNotes('');
    setPhotoData(null);
    setIsModalOpen(true);
  };

  // Handle Image Capture/Upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Resize image
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 600;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Convert to base64 (low quality JPEG)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          setPhotoData(dataUrl);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Cleaning Log
  const handleConfirmCleaning = async () => {
    if (!selectedUnit || !currentUser) return;
    
    setIsSubmitting(true);
    try {
      // 1. Insert Cleaning Log
      const nowIso = new Date().toISOString();
      const { data: logInsert, error: logError } = await supabase
        .from('cleaning_logs')
        .insert({
          unit_id: selectedUnit.id,
          cleaned_by: currentUser.id,
          cleaned_at: nowIso,
          notes: notes,
          photo_data: photoData
        })
        .select('id')
        .single();

      if (logError) {
         console.error('Error saving log:', logError);
      }

      // 2. Update Unit Status
      const { error: unitError } = await supabase
        .from('units')
        .update({ status: 'available' })
        .eq('id', selectedUnit.id);

      if (unitError) throw unitError;

      try {
        const msg = `تم تنظيف الغرفة ${selectedUnit.unit_number} في الفندق ${hotels.find(h => h.id === selectedUnit.hotel_id)?.name || ''}`;
        await supabase.from('system_events').insert({
          event_type: 'cleaning_done',
          unit_id: selectedUnit.id,
          hotel_id: selectedUnit.hotel_id,
          message: msg,
          payload: {
            notes,
            cleaning_log_id: logInsert?.id || null,
            cleaned_at: nowIso
          }
        });
      } catch (eventError) {
        console.error('Failed to log cleaning_done event:', eventError);
      }

      // Optimistic Update
      setUnits(prev => prev.map(u => 
        u.id === selectedUnit.id ? { ...u, status: 'available' } : u
      ));
      
      setIsModalOpen(false);

    } catch (error) {
      console.error('Error confirming cleaning:', error);
      alert('حدث خطأ أثناء تأكيد التنظيف');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddNote = async () => {
    if (!currentUser) return;
    if (!noteForm.target_user_id || !noteForm.content) {
      alert('يرجى اختيار الموظف وكتابة المحتوى');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: inserted, error } = await supabase
        .from('staff_notes')
        .insert({
          target_user_id: noteForm.target_user_id,
          created_by: currentUser.id,
          type: noteForm.type,
          severity: noteForm.severity,
          content: noteForm.content
        })
        .select('id')
        .single();

      if (error) throw error;

      try {
        const targetProfile = allProfiles.find(p => p.id === noteForm.target_user_id);
        const msg = `توجد ملاحظة على الموظف ${targetProfile?.full_name || ''}: ${noteForm.content.slice(0, 80)}`;
        await supabase.from('system_events').insert({
          event_type: 'staff_note',
          staff_note_id: inserted?.id || null,
          message: msg,
          payload: {
            type: noteForm.type,
            severity: noteForm.severity
          }
        });
      } catch (eventError) {
        console.error('Failed to log staff_note event:', eventError);
      }

      // Refresh list
      fetchNotes();
      setIsNoteModalOpen(false);
      setNoteForm({
        target_user_id: '',
        type: 'note',
        severity: 'low',
        content: ''
      });
      alert('تم إضافة الملاحظة بنجاح');

    } catch (error) {
      console.error('Error adding note:', error);
      alert('حدث خطأ أثناء إضافة الملاحظة');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update Status (Direct)
  const updateUnitStatus = async (unitId: string, newStatus: string) => {
    // If setting to available from cleaning, use the modal flow (optional, but requested for "Cleaned" action)
    // But for the dropdown in "All Units", we might want direct update or trigger modal.
    // The user said "When clicking Cleaned, show form".
    // In "All Units" tab, we have a dropdown. 
    // Let's keep dropdown for quick status change, but if they select "available" from "cleaning", maybe trigger modal?
    // For simplicity, I'll keep the dropdown as "Admin override" and the button as "Cleaner workflow".
    
    setUpdating(unitId);
    try {
      const { error } = await supabase
        .from('units')
        .update({ status: newStatus })
        .eq('id', unitId);

      if (error) throw error;

      // Optimistic Update
      setUnits(prev => prev.map(u => 
        u.id === unitId ? { ...u, status: newStatus as any } : u
      ));

    } catch (error) {
      console.error('Error updating status:', error);
      alert('حدث خطأ أثناء تحديث الحالة');
    } finally {
      setUpdating(null);
    }
  };

  // Filter Logic
  const filteredUnits = units.filter(unit => {
    // Hotel Filter
    if (selectedHotel !== 'all' && unit.hotel_id !== selectedHotel) return false;

    // Tab Filter
    if (activeTab === 'needs_cleaning') {
      return unit.status === 'cleaning';
    }
    
    return true;
  });

  // Group by Floor (Optional visualization improvement)
  const groupedUnits = filteredUnits.reduce((acc, unit) => {
    const floor = unit.floor || 'غير محدد';
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(unit);
    return acc;
  }, {} as Record<string, Unit[]>);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brush className="text-blue-600" />
            تنظيف الوحدات
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            إدارة ومتابعة نظافة الغرف والوحدات السكنية
          </p>
        </div>

        {/* Filters */}
        <div className="w-full md:w-auto flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
          <Filter size={18} className="text-gray-400 mr-1 shrink-0" />
          <select
            value={selectedHotel}
            onChange={(e) => setSelectedHotel(e.target.value)}
            className="w-full md:w-auto text-sm border-none focus:ring-0 text-gray-700 font-medium bg-transparent outline-none cursor-pointer min-w-[150px]"
          >
            <option value="all">كل الفنادق</option>
            {hotels.map(hotel => (
              <option key={hotel.id} value={hotel.id}>{hotel.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="-mb-px flex gap-6 min-w-max">
          <button
            onClick={() => setActiveTab('needs_cleaning')}
            className={cn(
              "pb-4 px-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2",
              activeTab === 'needs_cleaning'
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            <Brush size={16} />
            تحتاج تنظيف
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs">
              {units.filter(u => u.status === 'cleaning' && (selectedHotel === 'all' || u.hotel_id === selectedHotel)).length}
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab('all')}
            className={cn(
              "pb-4 px-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2",
              activeTab === 'all'
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            <BedDouble size={16} />
            كل الوحدات
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
              {selectedHotel === 'all' ? units.length : units.filter(u => u.hotel_id === selectedHotel).length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "pb-4 px-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2",
              activeTab === 'history'
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            <ClipboardList size={16} />
            سجل التنظيف
          </button>

          <button
            onClick={() => setActiveTab('notes')}
            className={cn(
              "pb-4 px-2 font-medium text-sm border-b-2 transition-colors flex items-center gap-2",
              activeTab === 'notes'
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            <MessageSquare size={16} />
            الملاحظات والمخالفات
          </button>
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-20 text-gray-500">جاري تحميل البيانات...</div>
      ) : activeTab === 'history' ? (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">تصفية:</span>
            </div>
            
            <div className="relative">
              <User size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={cleanerFilter}
                onChange={(e) => setCleanerFilter(e.target.value)}
                className="pr-9 pl-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="all">كل الموظفين</option>
                {allProfiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name || profile.email}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pr-9 pl-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            
            {(cleanerFilter !== 'all' || dateFilter) && (
              <button 
                onClick={() => { setCleanerFilter('all'); setDateFilter(''); }}
                className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                <X size={14} />
                مسح التصفيات
              </button>
            )}
          </div>

          {cleaningLogs.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <ClipboardList size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">لا توجد سجلات تنظيف</h3>
              <p className="text-gray-500">
                {(cleanerFilter !== 'all' || dateFilter) ? 'لا توجد نتائج تطابق التصفيات' : 'سجل التنظيف فارغ حالياً'}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile View (Cards) */}
              <div className="grid grid-cols-1 gap-4 md:hidden">
                {cleaningLogs.map((log) => (
                  <div key={log.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
                    <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                      <div>
                        <div className="font-bold text-gray-900 flex items-center gap-2">
                          {log.unit?.unit_number}
                          <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {log.unit?.hotel?.name}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <User size={12} />
                          {log.cleaner_name}
                        </div>
                      </div>
                      {log.status === 'confirmed' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle size={12} />
                          مؤكد
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <AlertCircle size={12} />
                          انتظار
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <div className="text-gray-600 flex flex-col text-xs">
                        <span>{new Date(log.cleaned_at).toLocaleDateString('en-GB')}</span>
                        <span className="text-gray-400">{new Date(log.cleaned_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      
                      {log.photo_data && (
                        <button
                          onClick={() => setSelectedImage(log.photo_data || null)}
                          className="text-blue-600 text-xs flex items-center gap-1 hover:underline"
                        >
                          <Camera size={14} />
                          عرض الصورة
                        </button>
                      )}
                    </div>

                    {log.notes && (
                      <div className="bg-gray-50 p-2 rounded text-xs text-gray-700 italic">
                        {log.notes}
                      </div>
                    )}

                    {log.status !== 'confirmed' && (
                      <button
                        onClick={() => handleConfirmLog(log)}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 mt-1"
                      >
                        <CheckCircle size={16} />
                        تأكيد التنظيف
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop View (Table) */}
              <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-gray-50 text-gray-700 font-medium border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-4">الوحدة</th>
                        <th className="px-6 py-4">المنفذ</th>
                        <th className="px-6 py-4">التاريخ</th>
                        <th className="px-6 py-4">ملاحظات</th>
                        <th className="px-6 py-4">الصورة</th>
                        <th className="px-6 py-4">الحالة</th>
                        <th className="px-6 py-4">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {cleaningLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900">{log.unit?.unit_number}</div>
                            <div className="text-xs text-gray-500">{log.unit?.hotel?.name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                                <User size={14} />
                              </div>
                              {log.cleaner_name}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-600 dir-ltr text-right">
                            <div className="flex items-center gap-2 justify-end">
                              {new Date(log.cleaned_at).toLocaleDateString('en-GB')}
                              <span className="text-xs text-gray-400">
                                {new Date(log.cleaned_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 max-w-[200px]">
                            {log.notes ? (
                              <span className="text-gray-700 truncate block" title={log.notes}>{log.notes}</span>
                            ) : (
                              <span className="text-gray-400 italic">لا توجد ملاحظات</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {log.photo_data ? (
                              <div 
                                className="relative group w-16 h-12 cursor-pointer"
                                onClick={() => setSelectedImage(log.photo_data || null)}
                              >
                                <img 
                                  src={log.photo_data} 
                                  alt="Cleaning" 
                                  className="w-full h-full object-cover rounded-lg border border-gray-200"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                  <span className="text-white text-xs">عرض</span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">تم حذف الصورة</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {log.status === 'confirmed' ? (
                              <div className="flex flex-col gap-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 w-fit">
                                  <CheckCircle size={12} />
                                  مؤكد
                                </span>
                                {log.confirmer_name && (
                                  <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <UserCheck size={10} />
                                    بواسطة: {log.confirmer_name}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                <AlertCircle size={12} />
                                بانتظار التأكيد
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {log.status !== 'confirmed' && (
                              <button
                                onClick={() => handleConfirmLog(log)}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                              >
                                <CheckCircle size={14} />
                                تأكيد
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      ) : activeTab === 'notes' ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200">
            <div>
              <h2 className="text-lg font-medium text-gray-900">سجل الملاحظات والمخالفات</h2>
              <p className="text-sm text-gray-500">متابعة أداء الموظفين وتسجيل الملاحظات الإدارية</p>
            </div>
            <button
              onClick={() => setIsNoteModalOpen(true)}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              إضافة ملاحظة
            </button>
          </div>

          {staffNotes.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <MessageSquare size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">لا توجد ملاحظات</h3>
              <p className="text-gray-500">لم يتم تسجيل أي ملاحظات أو مخالفات بعد</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {staffNotes.map((note) => (
                <div key={note.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
                        <User size={16} />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 text-sm">{note.target_user_name}</div>
                        <div className="text-xs text-gray-500">{new Date(note.created_at).toLocaleDateString('en-GB')}</div>
                      </div>
                    </div>
                    {note.type === 'violation' ? (
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1",
                        note.severity === 'low' ? "bg-amber-100 text-amber-700" :
                        note.severity === 'medium' ? "bg-orange-100 text-orange-700" :
                        "bg-red-100 text-red-700"
                      )}>
                        <AlertTriangle size={12} />
                        مخالفة ({note.severity === 'critical' ? 'جسيمة' : note.severity === 'high' ? 'عالية' : note.severity === 'medium' ? 'متوسطة' : 'بسيطة'})
                      </span>
                    ) : note.type === 'commendation' ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 flex items-center gap-1">
                        <Award size={12} />
                        تنويه
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 flex items-center gap-1">
                        <MessageSquare size={12} />
                        ملاحظة
                      </span>
                    )}
                  </div>
                  
                  <p className="text-gray-700 text-sm mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100 min-h-[60px]">
                    {note.content}
                  </p>
                  
                  <div className="flex justify-between items-center text-xs text-gray-400 border-t border-gray-100 pt-3">
                    <span>بواسطة: {note.creator_name}</span>
                    <span>{new Date(note.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : filteredUnits.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <CheckCircle size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">لا توجد وحدات</h3>
          <p className="text-gray-500">
            {activeTab === 'needs_cleaning' 
              ? 'جميع الوحدات نظيفة وجاهزة!' 
              : 'لا توجد وحدات مطابقة للفلتر المحدد'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredUnits.map((unit) => {
            const StatusIcon = STATUS_LABELS[unit.status].icon;
            return (
              <div 
                key={unit.id} 
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col gap-3"
              >
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      {unit.unit_number}
                      <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                        {unit.unit_type?.name}
                      </span>
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {unit.hotel?.name} • طابق {unit.floor}
                    </p>
                  </div>
                  <div className={cn(
                    "px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 border",
                    STATUS_LABELS[unit.status].color
                  )}>
                    <StatusIcon size={12} />
                    {STATUS_LABELS[unit.status].label}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-auto pt-3 border-t border-gray-100 flex gap-2">
                  {activeTab === 'needs_cleaning' ? (
                    <button
                      onClick={() => openCleaningModal(unit)}
                      disabled={updating === unit.id}
                      className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {updating === unit.id ? (
                        <span className="animate-spin">⌛</span>
                      ) : (
                        <>
                          <Check size={16} />
                          تم التنظيف
                        </>
                      )}
                    </button>
                  ) : (
                    <select
                      value={unit.status}
                      onChange={(e) => updateUnitStatus(unit.id, e.target.value)}
                      disabled={updating === unit.id}
                      className="w-full py-2 px-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 cursor-pointer outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                    >
                      <option value="available">متاح (نظيف)</option>
                      <option value="cleaning">يحتاج تنظيف</option>
                      <option value="maintenance">صيانة</option>
                      <option value="occupied">مشغول</option>
                    </select>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full flex items-center justify-center">
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 left-0 text-white hover:text-gray-300 p-2"
            >
              <X size={24} />
            </button>
            <img 
              src={selectedImage} 
              alt="Cleaning Proof" 
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {isNoteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare size={20} className="text-blue-600" />
                إضافة ملاحظة / مخالفة
              </h3>
              <button 
                onClick={() => setIsNoteModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Employee Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  الموظف المعني
                </label>
                <select
                  value={noteForm.target_user_id}
                  onChange={(e) => setNoteForm({...noteForm, target_user_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-right"
                >
                  <option value="">اختر الموظف...</option>
                  {allProfiles.map(profile => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name || profile.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Select */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    نوع السجل
                  </label>
                  <select
                    value={noteForm.type}
                    onChange={(e) => setNoteForm({...noteForm, type: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-right"
                  >
                    <option value="note">ملاحظة عامة</option>
                    <option value="violation">مخالفة</option>
                    <option value="commendation">تنويه / شكر</option>
                  </select>
                </div>
                
                {noteForm.type === 'violation' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      درجة المخالفة
                    </label>
                    <select
                      value={noteForm.severity}
                      onChange={(e) => setNoteForm({...noteForm, severity: e.target.value as any})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-right"
                    >
                      <option value="low">بسيطة</option>
                      <option value="medium">متوسطة</option>
                      <option value="high">عالية</option>
                      <option value="critical">جسيمة</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  نص الملاحظة
                </label>
                <textarea
                  value={noteForm.content}
                  onChange={(e) => setNoteForm({...noteForm, content: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none h-32 resize-none text-right"
                  placeholder="اكتب تفاصيل الملاحظة أو المخالفة هنا..."
                ></textarea>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                onClick={() => setIsNoteModalOpen(false)}
                className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddNote}
                disabled={isSubmitting || !noteForm.target_user_id || !noteForm.content}
                className={cn(
                  "px-4 py-2 text-white font-medium rounded-lg transition-colors flex items-center gap-2",
                  isSubmitting || !noteForm.target_user_id || !noteForm.content
                    ? "bg-blue-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {isSubmitting ? 'جاري الحفظ...' : 'حفظ الملاحظة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cleaning Confirmation Modal */}
      {isModalOpen && selectedUnit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">تأكيد تنظيف الوحدة</h3>
                <p className="text-sm text-gray-500">#{selectedUnit.unit_number} - {selectedUnit.hotel?.name}</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Cleaner Info */}
              <div className="bg-blue-50 p-3 rounded-lg flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-full text-blue-600">
                  <User size={18} />
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-medium mb-0.5">منفذ التنظيف</p>
                  <p className="text-sm font-bold text-gray-900">
                    {currentUser?.full_name || currentUser?.email || 'مستخدم غير معروف'}
                  </p>
                </div>
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  صورة الغرفة (مطلوب)
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageChange}
                    className="hidden"
                    id="cleaning-photo"
                  />
                  <label
                    htmlFor="cleaning-photo"
                    className={cn(
                      "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
                      photoData ? "border-green-300 bg-green-50" : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                    )}
                  >
                    {photoData ? (
                      <div className="relative w-full h-full p-2">
                        <img 
                          src={photoData} 
                          alt="Room Preview" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity rounded-lg">
                          <p className="text-white text-xs font-bold">تغيير الصورة</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Camera className="text-gray-400 mb-2" size={24} />
                        <p className="text-sm text-gray-500 font-medium">التقاط صورة للغرفة</p>
                        <p className="text-xs text-gray-400 mt-1">اضغط للكاميرا أو المعرض</p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  تقرير التنظيف (اختياري)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="هل هناك ملاحظات صيانة أو أضرار؟"
                  className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none h-24"
                />
              </div>
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                disabled={isSubmitting}
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmCleaning}
                disabled={isSubmitting || !photoData}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-200"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    تأكيد التنظيف
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
