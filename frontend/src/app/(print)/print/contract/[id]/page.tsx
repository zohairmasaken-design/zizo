import React from 'react';
import { createClient } from '@/lib/supabase-server';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { notFound } from 'next/navigation';
import PrintActions from '../../PrintActions';

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: booking, error } = await supabase
    .from('bookings')
    .select(`
      *,
      customer:customers(*),
      unit:units(
        *,
        unit_type:unit_types(
          *,
          hotel:hotels(*)
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error || !booking) {
    return notFound();
  }

  const hotel = booking.unit?.unit_type?.hotel || {
    name: 'شركة مساكن فندقية',
    address: 'المملكة العربية السعودية',
    phone: '',
    cr_number: '1010000000'
  };

  const today = format(new Date(), 'dd/MM/yyyy', { locale: ar });

  return (
    <div className="max-w-4xl mx-auto p-12 bg-white text-justify leading-relaxed min-h-screen relative" dir="rtl">
      {/* Decorative Border */}
      <div className="absolute inset-0 border-[16px] border-double border-gray-100 pointer-events-none m-4"></div>

      <div className="relative z-10 px-8 py-4">
        {/* Header */}
        <div className="flex flex-col items-center border-b-2 border-gray-900 pb-8 mb-10">
            {/* Logo Placeholder */}
            <div className="w-20 h-20 bg-gray-900 text-white flex items-center justify-center mb-6 rounded-full shadow-sm">
                <span className="font-bold text-lg">شعار</span>
            </div>
            
            <h1 className="text-4xl font-extrabold mb-2 text-gray-900">عقد إيجار وحدة سكنية</h1>
            <p className="text-gray-900 font-bold text-lg tracking-widest uppercase mb-6">Residential Rental Contract</p>
            
            <div className="flex gap-8 text-sm font-bold bg-gray-50 px-8 py-3 rounded-full border border-gray-200">
                <span className="flex items-center gap-2">
                    <span className="text-gray-800">رقم العقد:</span>
                    <span className="font-mono text-lg">{booking.id.slice(0, 8).toUpperCase()}</span>
                </span>
                <span className="w-px h-6 bg-gray-300"></span>
                <span className="flex items-center gap-2">
                    <span className="text-gray-800">تاريخ التحریر:</span>
                    <span className="font-mono text-lg">{today}</span>
                </span>
            </div>
        </div>

        {/* Preamble */}
        <div className="mb-10">
            <p className="mb-6 text-lg leading-loose">
            إنه في يوم <span className="font-bold border-b border-gray-400 px-2">{format(new Date(booking.created_at), 'eeee', { locale: ar })}</span> الموافق <span className="font-bold border-b border-gray-400 px-2 font-mono">{format(new Date(booking.created_at), 'dd/MM/yyyy')}</span>، تم الاتفاق بين كل من:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 my-8">
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="text-xs font-bold text-gray-800 uppercase mb-2 tracking-wider">الطرف الأول (المؤجر) / First Party</div>
                    <h3 className="font-bold text-xl text-gray-900 mb-2">{hotel.name}</h3>
                    <div className="space-y-1 text-sm text-gray-800">
                        <p>سجل تجاري: <span className="font-mono font-bold">{hotel.cr_number || '1010000000'}</span></p>
                        <p>العنوان: {hotel.address}</p>
                    </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="text-xs font-bold text-gray-800 uppercase mb-2 tracking-wider">الطرف الثاني (المستأجر) / Second Party</div>
                    <h3 className="font-bold text-xl text-gray-900 mb-2">{booking.customer?.full_name}</h3>
                    <div className="space-y-1 text-sm text-gray-800">
                        {booking.customer?.national_id && <p>رقم الهوية: <span className="font-mono font-bold">{booking.customer.national_id}</span></p>}
                        <p>رقم الجوال: <span className="font-mono font-bold" dir="ltr">{booking.customer?.phone}</span></p>
                    </div>
                </div>
            </div>
            
            <p className="text-lg">وقد اتفق الطرفان وهما بكامل الأهلية المعتبرة شرعاً ونظاماً على ما يلي:</p>
        </div>

        {/* Clauses */}
        <div className="space-y-8 counter-reset-clause">
            <div className="bg-white p-4 rounded-lg">
                <h3 className="font-bold text-xl mb-3 flex items-center gap-2 text-gray-900">
                    <span className="bg-gray-900 text-white w-8 h-8 flex items-center justify-center rounded-full text-sm">1</span>
                    موضوع العقد
                </h3>
                <p className="text-gray-700 leading-loose pr-10">
                    أجر الطرف الأول للطرف الثاني الوحدة السكنية رقم (<span className="font-bold text-gray-900">{booking.unit?.unit_number}</span>) 
                    من نوع (<span className="font-bold text-gray-900">{booking.unit?.unit_type?.name}</span>) 
                    الواقعة في مبنى الفندق، وذلك بقصد استعمالها للسكن فقط.
                </p>
            </div>

            <div className="bg-white p-4 rounded-lg">
                <h3 className="font-bold text-xl mb-3 flex items-center gap-2 text-gray-900">
                    <span className="bg-gray-900 text-white w-8 h-8 flex items-center justify-center rounded-full text-sm">2</span>
                    مدة العقد
                </h3>
                <p className="text-gray-700 leading-loose pr-10">
                    مدة هذا العقد هي (<span className="font-bold text-gray-900">{booking.nights}</span>) ليلة، 
                    تبدأ من تاريخ <span className="font-bold font-mono text-gray-900 border-b border-gray-300 px-1">{format(new Date(booking.check_in), 'dd/MM/yyyy')}</span> 
                    وتنتهي بتاريخ <span className="font-bold font-mono text-gray-900 border-b border-gray-300 px-1">{format(new Date(booking.check_out), 'dd/MM/yyyy')}</span>.
                </p>
            </div>

            <div className="bg-white p-4 rounded-lg">
                <h3 className="font-bold text-xl mb-3 flex items-center gap-2 text-gray-900">
                    <span className="bg-gray-900 text-white w-8 h-8 flex items-center justify-center rounded-full text-sm">3</span>
                    القيمة الإيجارية
                </h3>
                <p className="text-gray-700 leading-loose pr-10">
                    اتفق الطرفان على أن تكون القيمة الإجمالية للإيجار مبلغ وقدره (<span className="font-bold text-gray-900">{booking.total_price.toLocaleString()} ر.س</span>) 
                    شاملة ضريبة القيمة المضافة والخدمات.
                </p>
            </div>

            <div className="bg-white p-4 rounded-lg">
                <h3 className="font-bold text-xl mb-3 flex items-center gap-2 text-gray-900">
                    <span className="bg-gray-900 text-white w-8 h-8 flex items-center justify-center rounded-full text-sm">4</span>
                    التزامات المستأجر
                </h3>
                <ul className="list-disc list-outside space-y-2 pr-14 text-gray-700 leading-loose">
                    <li>يلتزم المستأجر بالمحافظة على العين المؤجرة واستخدامها للغرض المخصص لها (سكن عائلي/خاص).</li>
                    <li>لا يحق للمستأجر تأجير الوحدة للغير من الباطن أو التنازل عن العقد دون موافقة المؤجر الكتابية.</li>
                    <li>يلتزم المستأجر باتباع أنظمة وتعليمات إدارة المبنى فيما يخص الهدوء والنظافة العامة.</li>
                    <li>المستأجر مسؤول عن أي تلفيات تحدث في الوحدة أو محتوياتها أثناء فترة إقامته.</li>
                </ul>
            </div>

            <div className="bg-white p-4 rounded-lg">
                <h3 className="font-bold text-xl mb-3 flex items-center gap-2 text-gray-900">
                    <span className="bg-gray-900 text-white w-8 h-8 flex items-center justify-center rounded-full text-sm">5</span>
                    الإخلاء
                </h3>
                <p className="text-gray-700 leading-loose pr-10">
                    يلتزم المستأجر بإخلاء الوحدة وتسليم مفاتيحها للطرف الأول عند انتهاء مدة العقد في الموعد المحدد (الساعة 12:00 ظهراً)، 
                    وفي حال التأخير يحسب إيجار يوم كامل إضافي.
                </p>
            </div>
        </div>

        {/* Signatures */}
        <div className="mt-20 pt-10 border-t-2 border-gray-900">
            <div className="grid grid-cols-2 gap-20">
                <div className="text-center">
                    <p className="font-bold text-lg mb-8 text-gray-900">الطرف الأول (المؤجر)</p>
                    <p className="text-gray-900 mb-4 font-bold">{hotel.name}</p>
                    <div className="h-32 border-b-2 border-gray-300 relative">
                        <span className="absolute bottom-2 right-0 text-xs text-gray-800">التوقيع والختم</span>
                    </div>
                </div>
                <div className="text-center">
                    <p className="font-bold text-lg mb-8 text-gray-900">الطرف الثاني (المستأجر)</p>
                    <p className="text-gray-900 mb-4 font-bold">{booking.customer?.full_name}</p>
                    <div className="h-32 border-b-2 border-gray-300 relative">
                        <span className="absolute bottom-2 right-0 text-xs text-gray-800">التوقيع</span>
                    </div>
                </div>
            </div>
        </div>
      </div>

      <PrintActions />
    </div>
  );
}
