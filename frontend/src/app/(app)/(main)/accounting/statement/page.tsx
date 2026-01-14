'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { Search, Calendar, Download, Printer, ArrowLeftRight, User, FileText, ChevronDown as ChevronDownIcon } from 'lucide-react';

interface Account {
  id: string;
  code: string;
  name: string;
}

interface Customer {
  id: string;
  full_name: string;
  phone: string;
}

interface JournalLine {
  id: string;
  entry_date: string;
  voucher_number: string;
  description: string;
  debit: number;
  credit: number;
  balance?: number;
  reference_type?: string;
  reference_id?: string;
}

export default function AccountStatementPage() {
  const [mode, setMode] = useState<'account' | 'customer'>('account');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  // Data Lists
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  // Filters
  const [selectedId, setSelectedId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Results
  const [statement, setStatement] = useState<JournalLine[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [totals, setTotals] = useState({ debit: 0, credit: 0 });

  useEffect(() => {
    fetchLists();
  }, []);

  const fetchLists = async () => {
    // Fetch Accounts
    const { data: accs } = await supabase
      .from('accounts')
      .select('id, code, name')
      .order('code');
    if (accs) setAccounts(accs);

    // Fetch Customers
    const { data: custs } = await supabase
      .from('customers')
      .select('id, full_name, phone')
      .order('full_name');
    if (custs) setCustomers(custs);
  };

  const getCurrentOptions = () => {
    if (mode === 'account') {
      return accounts.map(acc => ({
        id: acc.id,
        label: `${acc.code} - ${acc.name}`,
      }));
    }
    return customers.map(cust => ({
      id: cust.id,
      label: cust.phone ? `${cust.full_name} - ${cust.phone}` : cust.full_name,
    }));
  };

  const filteredOptions = getCurrentOptions().filter(option =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectOption = (id: string, label: string) => {
    setSelectedId(id);
    setSearchQuery(label);
    setShowOptions(false);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      if (!searchQuery.trim()) return;
      const first = filteredOptions[0];
      if (first) {
        handleSelectOption(first.id, first.label);
      }
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchQuery(value);
    setShowOptions(Boolean(value.trim()));
  };

  const handleGenerate = async () => {
    if (!selectedId) {
      alert('الرجاء اختيار الحساب أو العميل');
      return;
    }

    setGenerating(true);
    setStatement([]);
    setOpeningBalance(0);

    try {
      let targetAccountId = selectedId;
      const useSubledger = mode === 'customer';

      if (useSubledger) {
        // Use the new RPC for Customer Statement (Sub-Account based)
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_customer_statement', {
            p_customer_id: selectedId,
            p_start_date: startDate,
            p_end_date: endDate
          });

        if (rpcError) throw rpcError;

        let totalDebit = 0;
        let totalCredit = 0;

        // The RPC returns running balance, but we might want to capture the first row's balance - (debit-credit) to find opening?
        // Actually, RPC handles opening balance internally and returns it in the first row's cumulative balance?
        // Let's look at RPC again: "SUM(...) OVER (...) + v_opening_balance". Yes.
        // But to display "Opening Balance" separately in the UI, we might need to extract it.
        // The UI displays `openingBalance` state variable separately.
        
        // Let's recalculate opening balance manually or extract from first row?
        // Better: The RPC is a "View". It returns rows.
        // We can just take the first row's balance - (debit - credit) = Previous Balance.
        // Or we can just calculate totals.
        
        // Wait, the UI has a specific `openingBalance` display.
        // Let's just fetch opening balance separately if we want to be precise, or deduce it.
        // RPC lines 45-53 calculate v_opening_balance.
        // Maybe I should modify RPC to return opening balance? 
        // Or just trust the RPC result for the table, and set `openingBalance` state to 0 (and let the first row show the cumulative).
        // But the UI likely shows "Opening Balance: X" at the top.
        
        // Let's fetch opening balance separately for the UI header
        // We need the account_id first.
        const { data: accData } = await supabase
          .from('customer_accounts')
          .select('account_id')
          .eq('customer_id', selectedId)
          .single();
        
        let openBal = 0;
        if (accData?.account_id) {
           // Calculate opening balance for this account
           const { data: opData } = await supabase
             .from('journal_lines')
             .select('debit, credit, journal_entries!inner(entry_date)')
             .eq('account_id', accData.account_id)
             .lt('journal_entries.entry_date', startDate)
             .eq('journal_entries.status', 'posted');
             
           if (opData) {
             openBal = opData.reduce((acc, line) => acc + (Number(line.debit) - Number(line.credit)), 0);
           }
        }
        setOpeningBalance(openBal);

        const processedLines = (rpcData || []).map((row: any, index: number) => {
           const debit = Number(row.debit);
           const credit = Number(row.credit);
           totalDebit += debit;
           totalCredit += credit;
           
           return {
             id: `row-${index}`,
             entry_date: row.transaction_date,
             voucher_number: row.voucher_number,
             description: row.description,
             debit,
             credit,
             balance: Number(row.balance), // Use RPC calculated balance
             reference_type: 'transaction', // Generic
             reference_id: null
           };
        });

        setStatement(processedLines);
        setTotals({ debit: totalDebit, credit: totalCredit });

      } else {
        // HIERARCHICAL LOGIC (Recursive for Parent + Sub-Accounts)
        
        // 1. Fetch Opening Balance (Recursive)
        const { data: openBalData, error: openBalError } = await supabase
          .rpc('get_account_balance_recursive', {
            p_account_id: targetAccountId,
            p_date: startDate
          });

        if (openBalError) throw openBalError;
        const openBal = Number(openBalData) || 0;
        setOpeningBalance(openBal);

        // 2. Fetch Statement Lines (Recursive)
        const { data: rpcLines, error: linesError } = await supabase
          .rpc('get_account_statement', {
            p_account_id: targetAccountId,
            p_start_date: startDate,
            p_end_date: endDate
          });

        if (linesError) throw linesError;

        // Process Lines
        let totalDebit = 0;
        let totalCredit = 0;

        const processedLines = (rpcLines || []).map((row: any) => {
          const debit = Number(row.debit);
          const credit = Number(row.credit);
          
          totalDebit += debit;
          totalCredit += credit;

          // Prepend Account Name if it's a sub-account transaction
          // (The RPC returns 'account_name' for each row)
          let displayDesc = row.description;
          if (row.account_name) {
             // We could check if it differs from the selected account name, 
             // but simply showing it is clearer for hierarchical views.
             displayDesc = `[${row.account_name}] ${displayDesc}`;
          }

          return {
            id: row.id,
            entry_date: row.transaction_date,
            voucher_number: row.voucher_number,
            description: displayDesc, 
            debit,
            credit,
            balance: Number(row.balance), // RPC returns calculated running balance
            reference_type: row.reference_type,
            reference_id: row.reference_id
          };
        });

        setStatement(processedLines);
        setTotals({ debit: totalDebit, credit: totalCredit });
      }

    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء جلب البيانات: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenPrint = () => {
    if (!selectedId) {
      alert('الرجاء اختيار الحساب أو العميل أولاً');
      return;
    }

    const params = new URLSearchParams({
      mode,
      id: selectedId,
      start: startDate,
      end: endDate,
    });

    window.open(`/print/statement?${params.toString()}`, '_blank');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-black flex items-center gap-2">
          <FileText className="text-blue-600" />
          كشف حساب
        </h1>
        <div className="flex gap-2">
          <button
            onClick={handleOpenPrint}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-black rounded-lg hover:bg-gray-200"
          >
            <Printer size={18} />
            طباعة
          </button>
          <button
            onClick={handleOpenPrint}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-black rounded-lg hover:bg-gray-200"
          >
            <Download size={18} />
            تصدير PDF
          </button>
        </div>
      </div>

      {/* Search Filter Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
          
          {/* Mode Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-black">نوع الكشف</label>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => { setMode('account'); setSelectedId(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                  mode === 'account' ? 'bg-white text-blue-600 shadow-sm' : 'text-black hover:text-black/70'
                }`}
              >
                <ArrowLeftRight size={16} />
                حساب مالي
              </button>
              <button
                onClick={() => { setMode('customer'); setSelectedId(''); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                  mode === 'customer' ? 'bg-white text-blue-600 shadow-sm' : 'text-black hover:text-black/70'
                }`}
              >
                <User size={16} />
                عميل
              </button>
            </div>
          </div>

          {/* Target Selection */}
          <div className="space-y-2 md:col-span-1">
            <label className="block text-sm font-medium text-black">
              {mode === 'account' ? 'اختر الحساب' : 'اختر العميل'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                placeholder={mode === 'account' ? 'ابحث بالرقم أو الاسم...' : 'ابحث بالاسم أو الجوال...'}
                className="w-full pl-4 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
              />
              {showOptions && searchQuery.trim() && (
                <div className="absolute inset-x-0 mt-1 max-h-56 bg-white border border-gray-200 rounded-lg shadow-lg overflow-y-auto z-10">
                  {filteredOptions.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500 text-right">
                      لا توجد نتائج مطابقة
                    </div>
                  ) : (
                    filteredOptions.map(option => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleSelectOption(option.id, option.label)}
                        className={`w-full text-right px-3 py-2 text-sm ${
                          option.id === selectedId
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-black hover:bg-gray-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-black">من تاريخ</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-black">إلى تاريخ</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-black"
            />
          </div>

          {/* Action Button */}
          <div className="md:col-span-4 flex justify-end">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {generating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  جاري العرض...
                </>
              ) : (
                <>
                  <Search size={18} />
                  عرض الكشف
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Summary Header */}
        <div className="p-6 bg-gray-50 border-b border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="text-sm text-black mb-1">الرصيد الافتتاح</div>
            <div className="text-lg font-bold text-black font-mono">
              {openingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="text-sm text-black mb-1">إجمالي المدين</div>
            <div className="text-lg font-bold text-black font-mono text-green-600">
              {totals.debit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="text-sm text-black mb-1">إجمالي الدائن</div>
            <div className="text-lg font-bold text-black font-mono text-red-600">
              {totals.credit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 shadow-sm">
            <div className="text-sm text-blue-600 mb-1">الرصيد الختامي</div>
            <div className="text-lg font-bold text-blue-900 font-mono">
              {(openingBalance + totals.debit - totals.credit).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-100 text-black font-bold text-sm">
              <tr>
                <th className="px-6 py-4">التاريخ</th>
                <th className="px-6 py-4">رقم القيد</th>
                <th className="px-6 py-4 w-1/3">البيان</th>
                <th className="px-6 py-4">مدين</th>
                <th className="px-6 py-4">دائن</th>
                <th className="px-6 py-4">الرصيد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* Opening Balance Row */}
              <tr className="bg-gray-50/50">
                <td className="px-6 py-4 text-black font-medium">{format(new Date(startDate), 'dd/MM/yyyy')}</td>
                <td className="px-6 py-4 text-black">-</td>
                <td className="px-6 py-4 font-bold text-black">رصيد افتتاحي</td>
                <td className="px-6 py-4 font-mono text-black">-</td>
                <td className="px-6 py-4 font-mono text-black">-</td>
                <td className="px-6 py-4 font-mono font-bold text-black dir-ltr text-right">
                  {openingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>

              {statement.length > 0 ? (
                statement.map((line) => (
                  <tr key={line.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-4 text-black">
                      {format(new Date(line.entry_date), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4 text-blue-600 font-mono text-sm hover:underline cursor-pointer">
                      {line.voucher_number}
                    </td>
                    <td className="px-6 py-4 text-black text-sm">
                      {line.description}
                    </td>
                    <td className="px-6 py-4 font-mono text-green-700">
                      {line.debit > 0 ? line.debit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="px-6 py-4 font-mono text-red-700">
                      {line.credit > 0 ? line.credit.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-black dir-ltr text-right">
                      {line.balance?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-black">
                    لا توجد حركات خلال هذه الفترة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
