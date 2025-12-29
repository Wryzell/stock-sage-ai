import { Link } from 'react-router-dom';
import { Plus, UserPlus, TrendingUp, FileText, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuickAction {
  label: string;
  icon: LucideIcon;
  href: string;
  variant?: 'default' | 'outline';
}

interface QuickActionsProps {
  isSuperAdmin: boolean;
}

export function QuickActions({ isSuperAdmin }: QuickActionsProps) {
  const adminActions: QuickAction[] = [
    { label: 'Add New Product', icon: Plus, href: '/products?action=add' },
    { label: 'Add Staff User', icon: UserPlus, href: '/settings?tab=users' },
    { label: 'Run AI Forecast', icon: TrendingUp, href: '/forecast?action=run' },
    { label: 'Generate Report', icon: FileText, href: '/reports?action=generate' },
  ];

  const staffActions: QuickAction[] = [
    { label: 'Record Sale', icon: Plus, href: '/sales?action=add' },
    { label: 'View Inventory', icon: FileText, href: '/products' },
    { label: 'Print Report', icon: FileText, href: '/reports' },
  ];

  const actions = isSuperAdmin ? adminActions : staffActions;

  return (
    <div className="card-stock-sage animate-fade-in">
      <h3 className="text-lg font-semibold text-heading mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.label} to={action.href}>
              <Button 
                variant="outline" 
                className="w-full justify-start gap-2 h-auto py-3"
              >
                <Icon size={18} />
                <span className="text-sm">{action.label}</span>
              </Button>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
