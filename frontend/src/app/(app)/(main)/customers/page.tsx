'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Search, 
  Plus, 
  User, 
  Building2, 
  Globe, 
  Briefcase, 
  Filter,
  MoreVertical,
  Phone,
  Mail,
  MapPin,
  FileText,
  Edit,
  MessageCircle,
  X
} from 'lucide-react';
import { CustomerModal, Customer as CustomerType, CustomerType as CustomerTypeEnum } from '@/components/customers/CustomerModal';

// Types (Reusing from Modal)
type Customer = CustomerType;

const CUSTOMER_TYPES: { id: CustomerTypeEnum | 'all'; label: string; icon: any }[] = [
  { id: 'all', label: 'الكل', icon: User },
  { id: 'individual', label: 'أفراد', icon: User },
  { id: 'company', label: 'شركات', icon: Building2 },
  { id: 'platform', label: 'منصات', icon: Globe },
  { id: 'broker', label: 'وسطاء', icon: Briefcase },
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<CustomerTypeEnum | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerToEdit, setCustomerToEdit] = useState<Customer | undefined>(undefined);
  const [activeCustomerIds, setActiveCustomerIds] = useState<string[]>([]);
  const [onlyActive, setOnlyActive] = useState(false);
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState<Customer | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, [selectedType, searchQuery]);

  useEffect(() => {
    fetchActiveCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectedType !== 'all') {
        query = query.eq('customer_type', selectedType);
      }

      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%,national_id.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      // @ts-ignore
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('customer_id, status')
        .in('status', ['checked_in', 'confirmed']);

      if (error) throw error;

      const ids = Array.from(
        new Set(
          (data || [])
            .map((b: any) => b.customer_id)
            .filter((id: string | null) => !!id)
        )
      ) as string[];

      setActiveCustomerIds(ids);
    } catch (error) {
      console.error('Error fetching active customers:', error);
    }
  };

  const handleEdit = (customer: Customer) => {
    setCustomerToEdit(customer);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setCustomerToEdit(undefined);
    setIsModalOpen(true);
  };

  const handleOpenDetails = (customer: Customer) => {
    setSelectedCustomerDetails(customer);
    setIsDetailsOpen(true);
  };

  const getCustomerIcon = (type: CustomerTypeEnum) => {
    switch (type) {
      case 'company': return <Building2 className="text-purple-500" size={20} />;
      case 'platform': return <Globe className="text-blue-500" size={20} />;
      case 'broker': return <Briefcase className="text-orange-500" size={20} />;
      default: return <User className="text-gray-500" size={20} />;
    }
  };

  const getCustomerLabel = (type: CustomerTypeEnum) => {
    const found = CUSTOMER_TYPES.find(t => t.id === type);
    return found ? found.label : type;
  };

  const activeSet = new Set(activeCustomerIds);
  const filteredCustomers = customers.filter((customer) => {
    if (onlyActive && !activeSet.has(customer.id)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة العملاء والضيوف</h1>
          <p className="text-gray-500 mt-1">قائمة بجميع العملاء والشركات والمنصات المسجلة</p>
        </div>
        <button 
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
          onClick={handleAdd}
        >
          <Plus size={20} />
          <span>عميل جديد</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="بحث بالاسم، رقم الجوال، أو الهوية..."
            className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {CUSTOMER_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id as CustomerTypeEnum | 'all')}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all
                ${selectedType === type.id 
                  ? 'bg-blue-50 text-blue-600 font-bold ring-1 ring-blue-200' 
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              <type.icon size={16} />
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setOnlyActive(false)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
            !onlyActive ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          كل العملاء
        </button>
        <button
          onClick={() => setOnlyActive(true)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border flex items-center gap-1 ${
            onlyActive ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          العملاء النشطين
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="text-gray-400" size={32} />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">لا يوجد عملاء</h3>
          <p className="text-gray-500 mt-2">لم يتم العثور على أي عملاء مطابقين للبحث</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group relative cursor-pointer"
              onClick={() => handleOpenDetails(customer)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                    {getCustomerIcon(customer.customer_type)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 line-clamp-1">{customer.full_name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 inline-block">
                        {getCustomerLabel(customer.customer_type)}
                      </span>
                      {activeSet.has(customer.id) && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                          نشط
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(customer);
                  }}
                  className="text-gray-400 hover:text-blue-600 p-1 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit size={16} />
                </button>
              </div>

              <div className="space-y-2.5 text-sm text-gray-500">
                {customer.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-gray-400" />
                    <span dir="ltr">{customer.phone}</span>
                  </div>
                )}
                {customer.national_id && (
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-gray-400" />
                    <span>{customer.national_id}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-gray-400" />
                    <span className="truncate">{customer.email}</span>
                  </div>
                )}
                {customer.nationality && (
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-gray-400" />
                    <span>{customer.nationality}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {customer.phone && (
                  <>
                    <a
                      href={`tel:${customer.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
                    >
                      <Phone size={14} />
                      اتصال
                    </a>
                    <a
                      href={`https://wa.me/${String(customer.phone).replace(/\\D/g, '').replace(/^0/, '966')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100"
                    >
                      <MessageCircle size={14} />
                      واتساب
                    </a>
                  </>
                )}
                {customer.email && (
                  <a
                    href={`mailto:${customer.email}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    <Mail size={14} />
                    إيميل
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CustomerModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchCustomers();
        }}
        // @ts-ignore
        customerToEdit={customerToEdit}
      />
      {selectedCustomerDetails && (
        <CustomerDetailsModal
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          customer={selectedCustomerDetails}
        />
      )}
    </div>
  );
}

interface CustomerBooking {
  id: string;
  booking_number?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  status?: string | null;
  total_price?: number | null;
  unit_number?: string | null;
}

function CustomerDetailsModal({
  isOpen,
  onClose,
  customer
}: {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
}) {
  const [loading, setLoading] = useState(true);
  const [netBalance, setNetBalance] = useState<number | null>(null);
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function loadDetails() {
      setLoading(true);
      setError(null);

      try {
        const { data: statementData, error: statementError } = await supabase.rpc('get_customer_statement', {
          p_customer_id: customer.id
        });

        if (statementError) {
          console.error('Error fetching customer statement:', statementError);
        } else if (statementData && statementData.length > 0) {
          const lastRow = statementData[statementData.length - 1] as any;
          if (!cancelled) {
            setNetBalance(Number(lastRow.balance) || 0);
          }
        } else if (!cancelled) {
          setNetBalance(0);
        }

        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select('id, check_in, check_out, status, total_price, units(unit_number)')
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false })
          .limit(20);

        if (bookingsError) {
          console.error('Error fetching customer bookings:', bookingsError);
        } else if (!cancelled) {
          const mapped = (bookingsData || []).map((b: any) => ({
            id: b.id,
            booking_number: b.booking_number,
            check_in: b.check_in,
            check_out: b.check_out,
            status: b.status,
            total_price: b.total_price ? Number(b.total_price) : null,
            unit_number: b.units?.unit_number || null
          }));
          setBookings(mapped);
        }
      } catch (err: any) {
        console.error('Error loading customer details:', err);
        if (!cancelled) {
          setError('حدث خطأ أثناء تحميل تفاصيل العميل');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDetails();

    return () => {
      cancelled = true;
    };
  }, [isOpen, customer.id]);

  if (!isOpen) return null;

  const formattedBalance =
    netBalance === null
      ? '...'
      : new Intl.NumberFormat('ar-SA', {
          style: 'currency',
          currency: 'SAR',
          maximumFractionDigits: 2
        }).format(netBalance);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">تفاصيل العميل</h2>
            <p className="text-sm text-gray-500 mt-1">{customer.full_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <div className="text-sm text-gray-600">
                <span className="font-semibold">نوع العميل: </span>
                <span>{CUSTOMER_TYPES.find(t => t.id === customer.customer_type)?.label}</span>
              </div>
              {customer.phone && (
                <div className="text-sm text-gray-600 flex items-center gap-2">
                  <Phone size={14} className="text-gray-400" />
                  <span dir="ltr">{customer.phone}</span>
                </div>
              )}
              {customer.email && (
                <div className="text-sm text-gray-600 flex items-center gap-2">
                  <Mail size={14} className="text-gray-400" />
                  <span className="truncate">{customer.email}</span>
                </div>
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">صافي حساب العميل</p>
                <p className="text-lg font-bold text-gray-900">{formattedBalance}</p>
              </div>
              <p className="text-[11px] text-gray-500 mt-2">
                المبلغ يمثل صافي رصيد العميل حسب القيود المحاسبية.
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">ملاحظات داخلية عن العميل</p>
            <div className="p-3 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-700 min-h-[60px]">
              {customer.details && customer.details.trim().length > 0
                ? customer.details
                : 'لا توجد ملاحظات مسجلة لهذا العميل.'}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">سجل الحجوزات</h3>
              <span className="text-xs text-gray-500">
                {bookings.length} حجز
              </span>
            </div>
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : bookings.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-gray-200 text-sm text-gray-500 text-center">
                لا توجد حجوزات مسجلة لهذا العميل.
              </div>
            ) : (
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">رقم الحجز</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">الوحدة</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">الدخول</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">الخروج</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">الحالة</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => (
                        <tr key={b.id} className="border-b border-gray-50">
                          <td className="px-4 py-2 text-gray-800">
                            {b.booking_number || b.id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-2 text-gray-700">
                            {b.unit_number || '-'}
                          </td>
                          <td className="px-4 py-2 text-gray-700">
                            {b.check_in
                              ? new Date(b.check_in).toLocaleDateString('ar-EG')
                              : '-'}
                          </td>
                          <td className="px-4 py-2 text-gray-700">
                            {b.check_out
                              ? new Date(b.check_out).toLocaleDateString('ar-EG')
                              : '-'}
                          </td>
                          <td className="px-4 py-2">
                            <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                              {b.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-800">
                            {b.total_price != null
                              ? new Intl.NumberFormat('ar-SA', {
                                  style: 'currency',
                                  currency: 'SAR',
                                  maximumFractionDigits: 0
                                }).format(b.total_price)
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
