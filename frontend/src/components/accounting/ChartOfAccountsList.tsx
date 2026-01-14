'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Edit2, Trash2, ChevronRight, ChevronDown, Folder, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Account {
  id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parent_id: string | null;
  is_active: boolean;
  children?: Account[];
}

interface ChartOfAccountsListProps {
  initialAccounts: Account[];
}

const ACCOUNT_TYPES = {
  asset: { label: 'الأصول', color: 'text-green-600 bg-green-50' },
  liability: { label: 'الالتزامات', color: 'text-red-600 bg-red-50' },
  equity: { label: 'حقوق الملكية', color: 'text-blue-600 bg-blue-50' },
  revenue: { label: 'الإيرادات', color: 'text-indigo-600 bg-indigo-50' },
  expense: { label: 'المصروفات', color: 'text-orange-600 bg-orange-50' }
};

export default function ChartOfAccountsList({ initialAccounts }: ChartOfAccountsListProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'asset' as Account['type'],
    parent_id: ''
  });

  const buildHierarchy = (accs: Account[]) => {
    const map: { [key: string]: Account } = {};
    const roots: Account[] = [];

    // Initialize map
    accs.forEach(acc => {
      map[acc.id] = { ...acc, children: [] };
    });

    // Build tree
    accs.forEach(acc => {
      if (acc.parent_id && map[acc.parent_id]) {
        map[acc.parent_id].children?.push(map[acc.id]);
      } else {
        roots.push(map[acc.id]);
      }
    });

    // Sort by code
    const sortRecursive = (nodes: Account[]) => {
      nodes.sort((a, b) => a.code.localeCompare(b.code));
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          sortRecursive(node.children);
        }
      });
    };

    sortRecursive(roots);
    return roots;
  };

  const hierarchy = buildHierarchy(accounts);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingId) {
        // Update
        const { data, error } = await supabase
          .from('accounts')
          .update({
            code: formData.code,
            name: formData.name,
            type: formData.type,
            parent_id: formData.parent_id || null
          })
          .eq('id', editingId)
          .select()
          .single();

        if (error) throw error;

        setAccounts(accounts.map(acc => acc.id === editingId ? data : acc));
      } else {
        // Insert
        const { data, error } = await supabase
          .from('accounts')
          .insert({
            code: formData.code,
            name: formData.name,
            type: formData.type,
            parent_id: formData.parent_id || null,
            is_active: true
          })
          .select()
          .single();

        if (error) throw error;

        setAccounts([...accounts, data]);
      }

      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ code: '', name: '', type: 'asset', parent_id: '' });
      router.refresh();
    } catch (err: any) {
      alert('خطأ في الحفظ: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (acc: Account) => {
    setEditingId(acc.id);
    setFormData({
      code: acc.code,
      name: acc.name,
      type: acc.type,
      parent_id: acc.parent_id || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الحساب؟')) return;
    
    try {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAccounts(accounts.filter(a => a.id !== id));
      router.refresh();
    } catch (err: any) {
      alert('لا يمكن حذف الحساب لأنه مرتبط بعمليات أخرى أو يحتوي على حسابات فرعية.');
    }
  };

  const AccountNode = ({ node, level = 0 }: { node: Account, level?: number }) => {
    const [expanded, setExpanded] = useState(true);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div className="select-none">
        <div 
          className={`flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg transition-colors ${level > 0 ? 'mr-6 border-r border-gray-100' : ''}`}
        >
          <button 
            onClick={() => setExpanded(!expanded)}
            className={`p-1 rounded hover:bg-gray-200 text-gray-400 ${!hasChildren && 'invisible'}`}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>

          <div className={`p-1.5 rounded-md ${ACCOUNT_TYPES[node.type].color}`}>
            {hasChildren ? <Folder size={18} /> : <FileText size={18} />}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-gray-600">{node.code}</span>
              <span className="font-medium text-gray-900">{node.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={(e) => { e.stopPropagation(); handleEdit(node); }}
              className="p-1 text-gray-400 hover:text-blue-600"
              title="تعديل"
            >
              <Edit2 size={16} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleDelete(node.id); }}
              className="p-1 text-gray-400 hover:text-red-600"
              title="حذف"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {expanded && hasChildren && (
          <div className="pr-4 border-r border-gray-100 mr-2">
            {node.children?.map(child => (
              <AccountNode key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-4 border-b flex justify-between items-center">
        <div className="flex gap-2">
          {Object.entries(ACCOUNT_TYPES).map(([key, value]) => (
            <div key={key} className={`px-2 py-1 rounded text-xs font-medium ${value.color}`}>
              {value.label}
            </div>
          ))}
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-bold text-sm"
        >
          <Plus size={18} />
          حساب جديد
        </button>
      </div>

      <div className="p-4">
        {hierarchy.length > 0 ? (
          <div className="space-y-1">
            {hierarchy.map(node => (
              <AccountNode key={node.id} node={node} />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-500">
            لا يوجد حسابات مضافة
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-4 text-gray-900">
              {editingId ? 'تعديل الحساب' : 'إضافة حساب جديد'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-1">نوع الحساب</label>
                <select 
                  value={formData.type}
                  onChange={e => setFormData({...formData, type: e.target.value as any})}
                  className="w-full p-2 border border-gray-300 rounded-lg text-gray-900 font-medium"
                  required
                >
                  {Object.entries(ACCOUNT_TYPES).map(([key, value]) => (
                    <option key={key} value={key} className="text-gray-900">{value.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-1">رمز الحساب</label>
                <input 
                  type="text" 
                  value={formData.code}
                  onChange={e => setFormData({...formData, code: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg text-gray-900 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-1">اسم الحساب</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg text-gray-900 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-1">الحساب الرئيسي (اختياري)</label>
                <select 
                  value={formData.parent_id}
                  onChange={e => setFormData({...formData, parent_id: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg text-gray-900 font-medium"
                >
                  <option value="" className="text-gray-900">لا يوجد (حساب رئيسي)</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id} className="text-gray-900">{acc.code} - {acc.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingId(null);
                    setFormData({ code: '', name: '', type: 'asset', parent_id: '' });
                  }}
                  className="flex-1 py-2 text-gray-900 font-bold hover:bg-gray-100 rounded-lg border border-gray-300"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'جاري الحفظ...' : 'حفظ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
