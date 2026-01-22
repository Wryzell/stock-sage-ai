import { useState } from 'react';
import { AlertTriangle, Info, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Alert {
  id: string;
  type: string;
  productId: string;
  productName: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
}

interface AlertsTableProps {
  alerts: Alert[];
  showResolveAction?: boolean;
}

export function AlertsTable({ alerts, showResolveAction = false }: AlertsTableProps) {
  const [resolving, setResolving] = useState<string | null>(null);
  const [localAlerts, setLocalAlerts] = useState(alerts);

  const getSeverityIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle size={16} className="text-danger" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-warning" />;
      default:
        return <Info size={16} className="text-primary" />;
    }
  };

  const getSeverityBadge = (severity: Alert['severity']) => {
    const classes = {
      critical: 'status-badge status-danger',
      warning: 'status-badge status-warning',
      info: 'status-badge bg-primary/10 text-primary',
    };
    return classes[severity];
  };

  const handleResolve = async (alertId: string) => {
    try {
      setResolving(alertId);
      const { error } = await supabase
        .from('alerts')
        .update({ is_resolved: true })
        .eq('id', alertId);
      
      if (error) throw error;
      
      setLocalAlerts(prev => prev.filter(a => a.id !== alertId));
      toast.success('Alert resolved');
    } catch (error) {
      toast.error('Failed to resolve alert');
    } finally {
      setResolving(null);
    }
  };

  // Use localAlerts if we have resolve action, otherwise use props
  const displayAlerts = showResolveAction ? localAlerts : alerts;

  if (displayAlerts.length === 0) {
    return (
      <div className="card-stock-sage animate-fade-in">
        <h3 className="text-lg font-semibold text-heading mb-4">Critical Alerts</h3>
        <div className="text-center py-8 text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No active alerts</p>
          <p className="text-sm">All inventory levels are healthy</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-stock-sage animate-fade-in">
      <h3 className="text-lg font-semibold text-heading mb-4">Critical Alerts</h3>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Severity</th>
              <th>Product</th>
              <th>Message</th>
              <th>Time</th>
              {showResolveAction && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {displayAlerts.map((alert) => (
              <tr key={alert.id}>
                <td>
                  <div className="flex items-center gap-2">
                    {getSeverityIcon(alert.severity)}
                    <span className={getSeverityBadge(alert.severity)}>
                      {alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)}
                    </span>
                  </div>
                </td>
                <td className="font-medium">{alert.productName}</td>
                <td className="max-w-xs truncate">{alert.message}</td>
                <td className="text-muted-foreground">
                  {new Date(alert.createdAt).toLocaleTimeString()}
                </td>
                {showResolveAction && (
                  <td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResolve(alert.id)}
                      disabled={resolving === alert.id}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Resolve
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
