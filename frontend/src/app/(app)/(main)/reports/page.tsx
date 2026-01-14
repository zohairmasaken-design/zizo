import React from 'react';
import Link from 'next/link';
import { FileBarChart, TrendingUp, DollarSign, Calendar, Users } from 'lucide-react';

export const metadata = {
  title: 'التقارير',
};

export default function ReportsPage() {
  const reports = [
    {
      title: 'ميزان المراجعة',
      description: 'كشف بأرصدة جميع الحسابات (أصول، خصوم، إيرادات، مصروفات) للتحقق من توازن القيد المزدوج.',
      icon: FileBarChart,
      color: 'bg-indigo-100 text-indigo-600',
      href: '/reports/trial-balance'
    },
    {
      title: 'تقرير الإيرادات',
      description: 'ملخص الإيرادات اليومية والشهرية والسنوية',
      icon: DollarSign,
      color: 'bg-green-100 text-green-600',
      href: '/reports/revenue'
    },
    {
      title: 'تقرير الإشغال',
      description: 'نسب الإشغال للوحدات والغرف',
      icon: TrendingUp,
      color: 'bg-blue-100 text-blue-600',
      href: '#'
    },
    {
      title: 'سجل الحجوزات',
      description: 'تقرير تفصيلي عن جميع الحجوزات وحالاتها',
      icon: Calendar,
      color: 'bg-purple-100 text-purple-600',
      href: '#'
    },
    {
      title: 'تقرير العملاء',
      description: 'تحليل بيانات العملاء والأكثر تردداً',
      icon: Users,
      color: 'bg-orange-100 text-orange-600',
      href: '#'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">التقارير</h1>
          <p className="text-gray-500 mt-1">تقارير وإحصائيات الأداء المالي والتشغيلي</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report, index) => (
          <Link 
            key={index} 
            href={report.href}
            className="block"
          >
            <div 
              className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer group h-full"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${report.color}`}>
                  <report.icon size={24} />
                </div>
                <div className="bg-gray-50 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <FileBarChart size={16} className="text-gray-400" />
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-gray-900 mb-2">{report.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                {report.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
      
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center mt-8">
        <h3 className="text-lg font-bold text-blue-800 mb-2">هل تحتاج تقارير مخصصة؟</h3>
        <p className="text-blue-600 mb-4">
          يمكنك طلب تقارير مخصصة حسب احتياجاتك من فريق الدعم الفني.
        </p>
        <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors">
          تواصل مع الدعم
        </button>
      </div>
    </div>
  );
}
