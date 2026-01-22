import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ActionType = 'create' | 'update' | 'delete' | 'view' | 'export' | 'import' | 'restore' | 'permanent_delete' | 'empty_trash';
export type EntityType = 'product' | 'sale' | 'forecast' | 'user' | 'supplier' | 'products' | 'sales';

interface LogAuditParams {
  actionType: ActionType;
  entityType: EntityType;
  entityId?: string;
  entityName?: string;
  details?: Record<string, unknown>;
}

export function useAuditLog() {
  const { user } = useAuth();

  const logAudit = async ({
    actionType,
    entityType,
    entityId,
    entityName,
    details
  }: LogAuditParams) => {
    try {
      const insertData = {
        user_id: user?.id || null,
        user_email: user?.email || null,
        user_name: user?.fullName || null,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId || null,
        entity_name: entityName || null,
        details: details ? JSON.parse(JSON.stringify(details)) : null
      };
      
      const { error } = await supabase
        .from('audit_logs')
        .insert(insertData);

      if (error) {
        console.error('Failed to log audit:', error);
      }
    } catch (err) {
      console.error('Audit log error:', err);
    }
  };

  return { logAudit };
}
