-- هذا الملف يقوم بإصلاح المشكلة بشكل كامل
-- 1. إنشاء الجدول إذا لم يكن موجوداً
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role text DEFAULT 'receptionist' CHECK (role IN ('admin', 'manager', 'receptionist')),
  email text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone
);

-- 2. تفعيل الحماية
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. دالة مساعدة لتجاوز التكرار اللانهائي في سياسات الأمان (Infinite Recursion Fix)
CREATE OR REPLACE FUNCTION public.get_my_role_safe()
RETURNS text AS $$
BEGIN
  RETURN (SELECT role FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. إضافة سياسات الأمان (لتجنب الأخطاء نقوم بحذف القديم أولاً)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins and Managers can view all profiles" ON public.profiles;
CREATE POLICY "Admins and Managers can view all profiles" ON public.profiles 
  FOR SELECT USING (
    public.get_my_role_safe() IN ('admin', 'manager')
  );

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles 
  FOR UPDATE USING (
    public.get_my_role_safe() = 'admin'
  );

-- 5. إصلاح البيانات (Backfill) - أهم خطوة
-- تقوم بنسخ جميع المستخدمين الحاليين إلى جدول الصلاحيات
INSERT INTO public.profiles (id, email, role, full_name)
SELECT 
  id, 
  email, 
  'receptionist', -- الافتراضي للجميع هو موظف استقبال
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 5. تعيين حسابك الخاص كمسؤول رئيسي (Root Admin)
UPDATE public.profiles 
SET role = 'admin' 
WHERE email ILIKE 'zizoalzohairy@gmail.com';

-- تحديث باقي المستخدمين الموجودين (اختياري - يمكنك إلغاء تعليق هذا السطر لجعل الجميع أدمن)
-- UPDATE public.profiles SET role = 'admin';

-- 7. إضافة وظيفة التحديث التلقائي للمستخدمين الجدد
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 
    'receptionist'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. دالة تحديث الصلاحيات
CREATE OR REPLACE FUNCTION public.update_user_role(target_user_id uuid, new_role text)
RETURNS void AS $$
BEGIN
  IF public.get_my_role_safe() != 'admin' THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  UPDATE public.profiles
  SET role = new_role, updated_at = now()
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
