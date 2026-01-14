import React from 'react';
import Link from 'next/link';
import { CreditCard, Settings, Users, Building, FileText } from 'lucide-react';
import { createClient } from '@/lib/supabase-server';

export const metadata = {
  title: 'الإعدادات',
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    isAdmin = profile?.role === 'admin';
  }

  const settingsGroups = [
    {
      title: 'إعدادات النظام',
      items: [
        {
          title: 'طرق الدفع',
          description: 'إدارة طرق الدفع وربطها بالحسابات المالية',
          icon: CreditCard,
          href: '/settings/payment-methods',
          color: 'bg-blue-100 text-blue-600'
        },
        {
          title: 'أنواع الوحدات',
          description: 'تعديل أسعار وأنواع الوحدات السكنية',
          icon: Building,
          href: '/units',
          color: 'bg-purple-100 text-purple-600'
        }
      ]
    },
    {
      title: 'إعدادات عامة',
      items: [
        {
          title: 'بيانات الفندق',
          description: 'تعديل اسم الفندق والشعار والضريبة',
          icon: FileText,
          href: '/settings/hotel-info',
          color: 'bg-orange-100 text-orange-600'
        }
      ]
    }
  ];

  if (isAdmin) {
    settingsGroups[0].items.push({
      title: 'المستخدمين والصلاحيات',
      description: 'إدارة صلاحيات المستخدمين والموظفين (Admin)',
      icon: Users,
      href: '/admin/users',
      color: 'bg-green-100 text-green-600'
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">الإعدادات</h1>
        <p className="text-gray-500 mt-1">التحكم في إعدادات النظام والخيارات المالية</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsGroups.map((group, idx) => (
          <React.Fragment key={idx}>
            {group.items.map((item, itemIdx) => (
              <Link 
                key={itemIdx} 
                href={item.href}
                className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow group"
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${item.color}`}>
                  <item.icon size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-500 mt-2">
                  {item.description}
                </p>
              </Link>
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
