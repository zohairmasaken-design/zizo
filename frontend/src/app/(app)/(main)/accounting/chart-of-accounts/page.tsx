import React from 'react';
import { createClient } from '@/lib/supabase-server';
import ChartOfAccountsList from '@/components/accounting/ChartOfAccountsList';

export const metadata = {
  title: 'دليل الحسابات',
};

export default async function ChartOfAccountsPage() {
  const supabase = await createClient();

  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .order('code', { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">دليل الحسابات</h1>
          <p className="text-gray-500 mt-1">إدارة شجرة الحسابات والهيكل المالي</p>
        </div>
      </div>

      <ChartOfAccountsList initialAccounts={accounts || []} />
    </div>
  );
}
