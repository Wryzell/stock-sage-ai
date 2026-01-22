import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { StatCard } from '@/components/StatCard';
import { AlertsTable } from '@/components/AlertsTable';
import { ForecastCard } from '@/components/ForecastCard';
import { QuickActions } from '@/components/QuickActions';
import { mockProducts, mockAlerts, mockUsers, mockSales } from '@/data/mockData';
import { Users, AlertTriangle, TrendingUp, ShoppingCart, Calculator } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const totalProducts = mockProducts.length;
  const lowStockItems = mockProducts.filter(p => p.status === 'low_stock' || p.status === 'out_of_stock').length;
  const activeStaff = mockUsers.filter(u => u.role === 'staff' && u.status === 'active').length;
  const todaySales = mockSales
    .filter(s => s.saleDate === '2024-12-29')
    .reduce((acc, s) => acc + s.total, 0);

  const forecastHighlights = [
    { product: 'Laptops', message: '+25% demand expected in January (Back to School)', trend: 'up' as const },
    { product: 'Webcams', message: 'Stockout risk in 5 days based on current velocity', trend: 'down' as const },
    { product: 'Accessories', message: 'Steady demand pattern detected', trend: 'steady' as const },
  ];

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
              value={`${activeStaff} users`}
              subtitle="Online now: 2"
              icon={Users}
              href="/settings"
            />
            <StatCard
              title="Low Stock Items"
              value={lowStockItems}
              subtitle="Requires attention"
              icon={AlertTriangle}
              href="/products?filter=low_stock"
            />
            <StatCard
              title="Today's Sales"
              value={`₱${todaySales.toLocaleString()}`}
              subtitle={`${mockSales.filter(s => s.saleDate === '2024-12-29').length} transactions`}
              icon={TrendingUp}
              trend={{ value: 12, isPositive: true }}
              href="/sales"
            />
            <StatCard
              title="Pricing Simulator"
              value="Optimize"
              subtitle="Price elasticity analysis"
              icon={Calculator}
              href="/pricing"
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <AlertsTable alerts={mockAlerts.slice(0, 4)} />
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
            value={mockSales.filter(s => s.recordedBy === user?.id).length}
            subtitle="Transactions recorded"
            icon={ShoppingCart}
            href="/sales"
          />
          <StatCard
            title="Low Stock Alerts"
            value={lowStockItems}
            subtitle="Items need attention"
            icon={AlertTriangle}
            href="/products?filter=low_stock"
          />
        </div>

        {/* Alerts */}
        <AlertsTable alerts={mockAlerts.slice(0, 5)} />
      </div>
    </Layout>
  );
}
