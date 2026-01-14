'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Users, Shield, Edit, Save, X, Check, Loader2, UserPlus, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'admin' | 'manager' | 'receptionist';
  created_at: string;
}

export default function UserManagementPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('receptionist');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 1. Get Current User Role
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Emergency Backdoor for Root Admin
      if (user.email === 'zizoalzohairy@gmail.com') {
        setCurrentUserRole('admin');
        
        // Auto-fix profile if missing for root
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single();
          
        if (!existingProfile) {
           await supabase.from('profiles').insert({
             id: user.id,
             email: user.email,
             role: 'admin',
             full_name: 'Root Admin'
           });
        }
      } else {
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        setCurrentUserRole(myProfile?.role || null);
      }

      // 2. Fetch All Profiles
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles(data || []);

    } catch (error: any) {
      console.error('Error fetching users FULL:', JSON.stringify(error, null, 2));
      console.error('Error message:', error.message);
      console.error('Error details:', error.details);
      console.error('Error hint:', error.hint);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (profile: Profile) => {
    setEditingId(profile.id);
    setSelectedRole(profile.role);
  };

  const handleSaveRole = async (userId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc('update_user_role', {
        target_user_id: userId,
        new_role: selectedRole
      });

      if (error) throw error;

      // Optimistic Update
      setProfiles(profiles.map(p => 
        p.id === userId ? { ...p, role: selectedRole as any } : p
      ));
      setEditingId(null);
      alert('تم تحديث الصلاحيات بنجاح');

    } catch (error: any) {
      console.error('Update Error:', error);
      alert('خطأ في التحديث: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (currentUserRole !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
        <Shield size={64} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">غير مصرح لك بالدخول</h1>
        <p className="text-gray-600">هذه الصفحة مخصصة للمشرفين (Admins) فقط.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="text-blue-600" />
            إدارة المستخدمين والصلاحيات
          </h1>
          <p className="text-gray-500 mt-1">عرض وتعديل صلاحيات الموظفين في النظام</p>
        </div>
        
        {/* <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <UserPlus size={18} />
          <span>دعوة مستخدم جديد</span>
        </button> */}
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="text-blue-600 mt-0.5" size={20} />
        <div>
          <h3 className="font-semibold text-blue-900">ملاحظة هامة</h3>
          <p className="text-sm text-blue-800">
            يتم إنشاء المستخدمين تلقائياً عند تسجيلهم لأول مرة. يمكنك هنا تعديل صلاحياتهم بعد التسجيل.
            <br />
            الصلاحيات المتاحة:
            <ul className="list-disc list-inside mt-1">
              <li><b>Admin:</b> تحكم كامل بالنظام.</li>
              <li><b>Manager:</b> إدارة الحجوزات والتقارير (لا يمكنه تعديل الصلاحيات).</li>
              <li><b>Receptionist:</b> إنشاء وتعديل الحجوزات فقط.</li>
            </ul>
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 font-semibold text-gray-900">الاسم / البريد الإلكتروني</th>
              <th className="px-6 py-4 font-semibold text-gray-900">الصلاحية الحالية</th>
              <th className="px-6 py-4 font-semibold text-gray-900">تاريخ الانضمام</th>
              <th className="px-6 py-4 font-semibold text-gray-900">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {profiles.map((profile) => (
              <tr key={profile.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{profile.full_name || 'بدون اسم'}</div>
                  <div className="text-sm text-gray-500 font-mono">{profile.email}</div>
                </td>
                
                <td className="px-6 py-4">
                  {editingId === profile.id ? (
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="receptionist">Receptionist</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      profile.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                      profile.role === 'manager' ? 'bg-orange-100 text-orange-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {profile.role.toUpperCase()}
                    </span>
                  )}
                </td>

                <td className="px-6 py-4 text-sm text-gray-500">
                  {profile.created_at ? format(new Date(profile.created_at), 'yyyy/MM/dd') : '-'}
                </td>

                <td className="px-6 py-4">
                  {editingId === profile.id ? (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleSaveRole(profile.id)}
                        disabled={saving}
                        className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                        title="حفظ"
                      >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      </button>
                      <button 
                        onClick={() => setEditingId(null)}
                        disabled={saving}
                        className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                        title="إلغاء"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleEditClick(profile)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 text-sm transition-colors"
                    >
                      <Edit size={14} />
                      <span>تعديل</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {profiles.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  لا يوجد مستخدمين مسجلين حالياً
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
