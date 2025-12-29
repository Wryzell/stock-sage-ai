import { Alert } from '@/types';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Info, AlertCircle } from 'lucide-react';

interface AlertsTableProps {
  alerts: Alert[];
  showActions?: boolean;
}

export function AlertsTable({ alerts, showActions = true }: AlertsTableProps) {
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
              {showActions && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
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
                <td>{alert.message}</td>
                <td className="text-muted-foreground">
                  {new Date(alert.createdAt).toLocaleTimeString()}
                </td>
                {showActions && (
                  <td>
                    {(alert.severity === 'critical' || alert.severity === 'warning') && (
                      <Button size="sm" className="text-xs">
                        Order Now
                      </Button>
                    )}
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
