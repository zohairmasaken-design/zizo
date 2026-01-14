-- ============================================================
-- سكربت تنظيف البيانات التشغيلية فقط (Operational Data Cleanup)
-- Description: 
-- 1. يقوم بحذف البيانات التشغيلية (فواتير، سندات، حجوزات، عملاء، فنادق).
-- 2. لا يحذف أي دالة (Functions) أو إجراء (Procedures).
-- 3. يحافظ على شجرة الحسابات الرئيسية وإعدادات النظام.
-- ============================================================

BEGIN;

-- تعطيل القيود مؤقتاً لتسريع الحذف وتجنب مشاكل الترتيب
SET session_replication_role = 'replica';

-- 1. حذف العمليات المالية (Financial Transactions)
-- الفواتير، السندات، القيود، تفاصيل القيود
TRUNCATE TABLE public.payment_allocations RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.payments RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.invoices RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.journal_lines RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.journal_entries RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.ar_subledger RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.revenue_schedules RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.audit_logs RESTART IDENTITY CASCADE;

-- 2. حذف العمليات التشغيلية (Operational Data)
-- الحجوزات، تفاصيل الحجز
TRUNCATE TABLE public.bookings RESTART IDENTITY CASCADE;
-- (Any other booking related tables if exist, e.g. booking_guests)

-- 3. حذف البيانات الأساسية التشغيلية (Master Operational Data)
-- العملاء، الوحدات، الفنادق
TRUNCATE TABLE public.customer_accounts RESTART IDENTITY CASCADE; -- جدول الربط
TRUNCATE TABLE public.customers RESTART IDENTITY CASCADE;

-- 4. تنظيف الحسابات الفرعية للعملاء فقط (Customer Sub-Accounts)
-- نحذف فقط الحسابات التي تم إنشاؤها للعملاء تحت الحساب الرئيسي 1200
-- لا نحذف الحسابات النظامية أو الرئيسية
DELETE FROM public.accounts 
WHERE parent_id IN (SELECT id FROM public.accounts WHERE code = '1200')
AND is_system = false;

-- إعادة تفعيل القيود
SET session_replication_role = 'origin';

COMMIT;

SELECT 'تم تنظيف البيانات التشغيلية بنجاح. الدوال والإعدادات الرئيسية محفوظة.' as status;
