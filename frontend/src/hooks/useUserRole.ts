import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export type UserRole = 'admin' | 'manager' | 'receptionist' | null;

export function useUserRole() {
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          if (mounted) {
            setRole(null);
            setLoading(false);
          }
          return;
        }

        // Emergency backdoor for root admin (matches logic in user management)
        if (user.email === 'zizoalzohairy@gmail.com') {
          if (mounted) {
            setRole('admin');
            setLoading(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) {
          // If profile doesn't exist, default to receptionist
          if (error.code === 'PGRST116') {
             if (mounted) setRole('receptionist');
          } else {
             throw error;
          }
        } else {
          if (mounted) setRole(data.role as UserRole);
        }
      } catch (err: any) {
        console.error('Error fetching user role:', err);
        if (mounted) {
          setError(err);
          // Default to safe role on error
          setRole('receptionist'); 
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchRole();

    return () => {
      mounted = false;
    };
  }, []);

  return { role, loading, error };
}
