import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { StatCard } from '@/components/StatCard';
import { AlertsTable } from '@/components/AlertsTable';
import { ForecastCard } from '@/components/ForecastCard';
import { QuickActions } from '@/components/QuickActions';
import { ForecastChart } from '@/components/ForecastChart';
import { mockProducts, mockAlerts, mockUsers, mockSales } from '@/data/mockData';
import { Package, Users, AlertTriangle, TrendingUp, ShoppingCart, ClipboardList } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

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

  const staffAssignedProducts = mockProducts.slice(0, 5);

  if (isSuperAdmin) {
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Products"
              value={totalProducts}
              subtitle={`${mockProducts.filter(p => p.status === 'in_stock').length} in stock`}
              icon={Package}
            />
            <StatCard
              title="Active Staff"
              value={`${activeStaff} users`}
              subtitle="Online now: 2"
              icon={Users}
            />
            <StatCard
              title="Low Stock Items"
              value={lowStockItems}
              subtitle="Requires attention"
              icon={AlertTriangle}
            />
            <StatCard
              title="Today's Sales"
              value={`₱${todaySales.toLocaleString()}`}
              subtitle={`${mockSales.filter(s => s.saleDate === '2024-12-29').length} transactions`}
              icon={TrendingUp}
              trend={{ value: 12, isPositive: true }}
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ForecastChart />
            </div>
            <div>
              <QuickActions isSuperAdmin={isSuperAdmin} />
            </div>
          </div>
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
            Welcome, {user?.fullName}. Here are your assigned tasks.
          </p>
        </div>

        {/* Staff Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="Assigned Products"
            value={staffAssignedProducts.length}
            subtitle="Products to manage"
            icon={Package}
          />
          <StatCard
            title="Today's Sales"
            value={mockSales.filter(s => s.recordedBy === user?.id).length}
            subtitle="Transactions recorded"
            icon={ShoppingCart}
          />
          <StatCard
            title="Pending Tasks"
            value={3}
            subtitle="Complete by end of day"
            icon={ClipboardList}
          />
        </div>

        {/* Staff Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="card-stock-sage animate-fade-in">
              <h3 className="text-lg font-semibold text-heading mb-4">My Assigned Products</h3>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product Name</th>
                      <th>Category</th>
                      <th>Current Stock</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffAssignedProducts.map((product) => (
                      <tr key={product.id}>
                        <td className="font-medium">{product.name}</td>
                        <td>{product.category}</td>
                        <td>{product.currentStock}</td>
                        <td>
                          <span className={`status-badge ${
                            product.status === 'in_stock' ? 'status-success' :
                            product.status === 'low_stock' ? 'status-warning' : 'status-danger'
                          }`}>
                            {product.status === 'in_stock' ? 'In Stock' :
                             product.status === 'low_stock' ? 'Low Stock' : 'Out of Stock'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card-stock-sage animate-fade-in">
              <h3 className="text-lg font-semibold text-heading mb-4">Today's Tasks</h3>
              <ul className="space-y-3">
                <li className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border border-border">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  <span className="text-sm">Record sales transactions</span>
                </li>
                <li className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border border-border">
                  <div className="w-2 h-2 rounded-full bg-warning"></div>
                  <span className="text-sm">Check inventory levels</span>
                </li>
                <li className="flex items-center gap-3 p-3 rounded-md bg-muted/50 border border-border">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground"></div>
                  <span className="text-sm">Print daily report</span>
                </li>
              </ul>
            </div>

            <AlertsTable alerts={mockAlerts.slice(0, 3)} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
