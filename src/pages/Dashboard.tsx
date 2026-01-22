import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { StatCard } from '@/components/StatCard';
import { AlertsTable } from '@/components/AlertsTable';
import { ForecastCard } from '@/components/ForecastCard';
import { QuickActions } from '@/components/QuickActions';
import { supabase } from '@/integrations/supabase/client';
import { Users, AlertTriangle, TrendingUp, ShoppingCart, Calculator, Loader2, Brain } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';

interface DashboardStats {
  activeStaff: number;
  lowStockItems: number;
  todaySales: number;
  todayTransactions: number;
}

interface Alert {
  id: string;
  type: string;
  productId: string;
  productName: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
}

interface ForecastHighlight {
  product: string;
  message: string;
  trend: 'up' | 'down' | 'steady';
}

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    activeStaff: 0,
    lowStockItems: 0,
    todaySales: 0,
    todayTransactions: 0,
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [forecastHighlights, setForecastHighlights] = useState<ForecastHighlight[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const today = new Date();
      const todayStart = startOfDay(today).toISOString();
      const todayEnd = endOfDay(today).toISOString();
      
      // Fetch all data in parallel
      const [
        profilesRes,
        productsRes,
        salesRes,
        alertsRes,
      ] = await Promise.all([
        // Active staff count
        supabase
          .from('profiles')
          .select('id', { count: 'exact' })
          .eq('status', 'active')
          .eq('role', 'staff'),
        
        // Products for low stock count
        supabase
          .from('products')
          .select('id, current_stock, min_stock')
          .is('deleted_at', null),
        
        // Today's sales
        supabase
          .from('sales')
          .select('id, total')
          .is('deleted_at', null)
          .gte('sale_date', todayStart)
          .lte('sale_date', todayEnd),
        
        // Recent alerts
        supabase
          .from('alerts')
          .select('*')
          .eq('is_resolved', false)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      // Calculate stats
      const activeStaff = profilesRes.count || 0;
      
      const products = productsRes.data || [];
      const lowStockItems = products.filter(p => p.current_stock <= p.min_stock).length;
      
      const sales = salesRes.data || [];
      const todaySales = sales.reduce((sum, s) => sum + Number(s.total), 0);
      const todayTransactions = sales.length;
      
      setStats({
        activeStaff,
        lowStockItems,
        todaySales,
        todayTransactions,
      });
      
      // Map alerts
      const mappedAlerts: Alert[] = (alertsRes.data || []).map(a => ({
        id: a.id,
        type: a.type,
        productId: a.product_id || '',
        productName: a.product_name,
        message: a.message,
        severity: a.severity as 'info' | 'warning' | 'critical',
        createdAt: a.created_at,
      }));
      setAlerts(mappedAlerts);
      
      // Generate forecast highlights from alerts
      const highlights: ForecastHighlight[] = [];
      
      const criticalAlerts = mappedAlerts.filter(a => a.severity === 'critical');
      if (criticalAlerts.length > 0) {
        highlights.push({
          product: `${criticalAlerts.length} Products`,
          message: 'Critical stock levels detected. Immediate reorder recommended.',
          trend: 'down',
        });
      }
      
      const warningAlerts = mappedAlerts.filter(a => a.severity === 'warning');
      if (warningAlerts.length > 0) {
        highlights.push({
          product: `${warningAlerts.length} Products`,
          message: 'Stock running low. Plan reorders soon.',
          trend: 'down',
        });
      }
      
      if (lowStockItems === 0) {
        highlights.push({
          product: 'Inventory',
          message: 'All stock levels healthy. No immediate action needed.',
          trend: 'steady',
        });
      }
      
      // Add a prompt to use AI Engine
      highlights.push({
        product: 'AI Engine',
        message: 'Generate detailed demand forecasts with price intelligence.',
        trend: 'up',
      });
      
      setForecastHighlights(highlights);
      
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (isAdmin) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-heading">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back, {user?.fullName}. Here's your inventory overview.
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="Active Staff"
              value={`${stats.activeStaff} users`}
              subtitle="Currently active"
              icon={Users}
              href="/settings"
            />
            <StatCard
              title="Low Stock Items"
              value={stats.lowStockItems}
              subtitle="Requires attention"
              icon={AlertTriangle}
              href="/products?filter=low_stock"
            />
            <StatCard
              title="Today's Sales"
              value={`₱${stats.todaySales.toLocaleString()}`}
              subtitle={`${stats.todayTransactions} transactions`}
              icon={TrendingUp}
              href="/sales"
            />
            <StatCard
              title="AI Forecasting"
              value="Analyze"
              subtitle="Demand predictions"
              icon={Brain}
              href="/ai"
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <AlertsTable alerts={alerts} showResolveAction />
            </div>
            <div>
              <ForecastCard highlights={forecastHighlights} />
            </div>
          </div>

          <QuickActions isAdmin={isAdmin} />
        </div>
      </Layout>
    );
  }

  // Staff Dashboard
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-heading">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome, {user?.fullName}. Here's your overview.
          </p>
        </div>

        {/* Staff Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard
            title="Today's Sales"
            value={`₱${stats.todaySales.toLocaleString()}`}
            subtitle={`${stats.todayTransactions} transactions`}
            icon={ShoppingCart}
            href="/sales"
          />
          <StatCard
            title="Low Stock Alerts"
            value={stats.lowStockItems}
            subtitle="Items need attention"
            icon={AlertTriangle}
            href="/products?filter=low_stock"
          />
        </div>

        {/* Alerts */}
        <AlertsTable alerts={alerts} />
      </div>
    </Layout>
  );
}
