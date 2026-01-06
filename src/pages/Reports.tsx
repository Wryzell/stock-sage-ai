import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download, Printer, Calendar, BarChart3, TrendingUp, Users, DollarSign, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, subMonths } from 'date-fns';

import { LucideIcon } from 'lucide-react';

interface ReportType {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

interface SaleRecord {
  id: string;
  quantity: number;
  unit_price: number;
  total: number;
  sale_date: string;
  product_id: string;
  productName?: string;
  category?: string;
}

interface DailySummary {
  date: string;
  totalSales: number;
  transactionCount: number;
  topProduct: string;
}

interface MonthlySummary {
  month: string;
  totalSales: number;
  transactionCount: number;
  avgTransactionValue: number;
  growth: number | null;
}

const reportTypes: ReportType[] = [
  { id: 'daily', name: 'Daily Income Report', description: 'Sales and income by day', icon: Calendar },
  { id: 'monthly', name: 'Monthly Income Report', description: 'Monthly revenue summary', icon: BarChart3 },
  { id: 'inventory', name: 'Inventory Summary', description: 'Current stock levels and valuation', icon: BarChart3 },
  { id: 'sales', name: 'Sales Analysis', description: 'Sales performance and trends', icon: TrendingUp },
  { id: 'forecast', name: 'Forecast Accuracy', description: 'AI prediction accuracy metrics', icon: BarChart3, adminOnly: true },
  { id: 'staff', name: 'Staff Activity', description: 'User actions and transactions', icon: Users, adminOnly: true },
  { id: 'financial', name: 'Financial Summary', description: 'Revenue, costs, and margins', icon: DollarSign, adminOnly: true },
];

export default function Reports() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  
  const [selectedReport, setSelectedReport] = useState<string>('daily');
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  
  // Report data states
  const [dailySummaries, setDailySummaries] = useState<DailySummary[]>([]);
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([]);
  const [inventorySummary, setInventorySummary] = useState<{ category: string; products: number; totalStock: number; valuation: number }[]>([]);
  const [salesData, setSalesData] = useState<{ totalRevenue: number; transactions: number; avgTransaction: number }>({ totalRevenue: 0, transactions: 0, avgTransaction: 0 });

  const availableReports = isSuperAdmin 
    ? reportTypes 
    : reportTypes.filter(r => !r.adminOnly);

  const fetchDailyReport = async () => {
    setLoading(true);
    try {
      const { data: sales, error } = await supabase
        .from('sales')
        .select('*, products(name, category)')
        .gte('sale_date', startOfDay(new Date(dateFrom)).toISOString())
        .lte('sale_date', endOfDay(new Date(dateTo)).toISOString())
        .order('sale_date', { ascending: false });

      if (error) throw error;

      // Group by day
      const dailyMap = new Map<string, { sales: number; count: number; products: Map<string, number> }>();
      
      sales?.forEach((sale: any) => {
        const day = format(new Date(sale.sale_date), 'yyyy-MM-dd');
        const existing = dailyMap.get(day) || { sales: 0, count: 0, products: new Map() };
        existing.sales += Number(sale.total);
        existing.count += 1;
        const productName = sale.products?.name || 'Unknown';
        existing.products.set(productName, (existing.products.get(productName) || 0) + sale.quantity);
        dailyMap.set(day, existing);
      });

      const summaries: DailySummary[] = Array.from(dailyMap.entries()).map(([date, data]) => {
        let topProduct = 'N/A';
        let maxQty = 0;
        data.products.forEach((qty, name) => {
          if (qty > maxQty) {
            maxQty = qty;
            topProduct = name;
          }
        });
        return {
          date,
          totalSales: data.sales,
          transactionCount: data.count,
          topProduct,
        };
      });

      setDailySummaries(summaries);
    } catch (error) {
      console.error('Error fetching daily report:', error);
      toast.error('Failed to fetch daily report');
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlyReport = async () => {
    setLoading(true);
    try {
      // Fetch last 6 months
      const sixMonthsAgo = subMonths(new Date(), 6);
      const { data: sales, error } = await supabase
        .from('sales')
        .select('*')
        .gte('sale_date', startOfMonth(sixMonthsAgo).toISOString())
        .order('sale_date', { ascending: true });

      if (error) throw error;

      // Group by month
      const monthlyMap = new Map<string, { sales: number; count: number }>();
      
      sales?.forEach((sale: any) => {
        const month = format(new Date(sale.sale_date), 'yyyy-MM');
        const existing = monthlyMap.get(month) || { sales: 0, count: 0 };
        existing.sales += Number(sale.total);
        existing.count += 1;
        monthlyMap.set(month, existing);
      });

      const months = Array.from(monthlyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      const summaries: MonthlySummary[] = months.map(([month, data], index) => {
        const prevData = index > 0 ? months[index - 1][1] : null;
        const growth = prevData && prevData.sales > 0 
          ? ((data.sales - prevData.sales) / prevData.sales) * 100 
          : null;
        
        return {
          month: format(new Date(month + '-01'), 'MMMM yyyy'),
          totalSales: data.sales,
          transactionCount: data.count,
          avgTransactionValue: data.count > 0 ? data.sales / data.count : 0,
          growth,
        };
      });

      setMonthlySummaries(summaries);
    } catch (error) {
      console.error('Error fetching monthly report:', error);
      toast.error('Failed to fetch monthly report');
    } finally {
      setLoading(false);
    }
  };

  const fetchInventoryReport = async () => {
    setLoading(true);
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('*');

      if (error) throw error;

      // Group by category
      const categoryMap = new Map<string, { count: number; stock: number; value: number }>();
      
      products?.forEach((product: any) => {
        const cat = product.category || 'Uncategorized';
        const existing = categoryMap.get(cat) || { count: 0, stock: 0, value: 0 };
        existing.count += 1;
        existing.stock += product.current_stock || 0;
        existing.value += (product.current_stock || 0) * Number(product.selling_price || 0);
        categoryMap.set(cat, existing);
      });

      const summaries = Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        products: data.count,
        totalStock: data.stock,
        valuation: data.value,
      }));

      setInventorySummary(summaries);
    } catch (error) {
      console.error('Error fetching inventory report:', error);
      toast.error('Failed to fetch inventory report');
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesReport = async () => {
    setLoading(true);
    try {
      const { data: sales, error } = await supabase
        .from('sales')
        .select('*')
        .gte('sale_date', startOfDay(new Date(dateFrom)).toISOString())
        .lte('sale_date', endOfDay(new Date(dateTo)).toISOString());

      if (error) throw error;

      const totalRevenue = sales?.reduce((sum: number, s: any) => sum + Number(s.total), 0) || 0;
      const transactions = sales?.length || 0;
      
      setSalesData({
        totalRevenue,
        transactions,
        avgTransaction: transactions > 0 ? totalRevenue / transactions : 0,
      });
    } catch (error) {
      console.error('Error fetching sales report:', error);
      toast.error('Failed to fetch sales report');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = () => {
    switch (selectedReport) {
      case 'daily':
        fetchDailyReport();
        break;
      case 'monthly':
        fetchMonthlyReport();
        break;
      case 'inventory':
        fetchInventoryReport();
        break;
      case 'sales':
        fetchSalesReport();
        break;
      default:
        toast.info('Report type coming soon');
    }
  };

  useEffect(() => {
    handleGenerate();
  }, [selectedReport]);

  const handleExport = (format: 'excel' | 'pdf') => {
    toast.success(`Exporting report as ${format.toUpperCase()}...`);
  };

  const handlePrint = () => {
    window.print();
    toast.success('Print dialog opened');
  };

  const formatCurrency = (value: number) => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  const getTotalDailySales = () => dailySummaries.reduce((sum, d) => sum + d.totalSales, 0);
  const getTotalDailyTransactions = () => dailySummaries.reduce((sum, d) => sum + d.transactionCount, 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-heading">Reports</h1>
            <p className="text-muted-foreground mt-1">
              {isSuperAdmin ? 'Generate and export comprehensive reports' : 'View and print daily reports'}
            </p>
          </div>
        </div>

        {/* Report Selection */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <div className="card-stock-sage animate-fade-in">
              <h3 className="text-lg font-semibold text-heading mb-4">Report Type</h3>
              <div className="space-y-2">
                {availableReports.map((report) => {
                  const Icon = report.icon;
                  const isSelected = selectedReport === report.id;
                  return (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReport(report.id)}
                      className={`w-full text-left p-3 rounded-md border transition-colors ${
                        isSelected 
                          ? 'border-primary bg-primary-light' 
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon size={20} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                        <div>
                          <p className={`font-medium ${isSelected ? 'text-primary' : 'text-heading'}`}>
                            {report.name}
                          </p>
                          <p className="text-sm text-muted-foreground">{report.description}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {/* Filters */}
            <div className="card-stock-sage animate-fade-in">
              <h3 className="text-lg font-semibold text-heading mb-4">Report Parameters</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Date From</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Date To</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex items-end">
                  <Button onClick={handleGenerate} className="gap-2" disabled={loading}>
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
                    Generate Report
                  </Button>
                </div>
              </div>
            </div>

            {/* Report Preview */}
            <div className="card-stock-sage animate-fade-in print:shadow-none">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-heading">
                  {availableReports.find(r => r.id === selectedReport)?.name}
                </h3>
                <div className="flex gap-2 print:hidden">
                  {isSuperAdmin && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => handleExport('excel')} className="gap-2">
                        <Download size={16} />
                        Excel
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} className="gap-2">
                        <Download size={16} />
                        PDF
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                    <Printer size={16} />
                    Print
                  </Button>
                </div>
              </div>

              {/* Report Header */}
              <div className="border border-border rounded-md p-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-primary">STOCK SAGE</h2>
                  <p className="text-sm text-muted-foreground">Inventory Management System</p>
                </div>

                <div className="border-t border-b border-border py-4 mb-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Report Type:</span>
                      <span className="ml-2 font-medium">{availableReports.find(r => r.id === selectedReport)?.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Generated:</span>
                      <span className="ml-2 font-medium">{format(new Date(), 'MMM dd, yyyy HH:mm')}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Period:</span>
                      <span className="ml-2 font-medium">{dateFrom} to {dateTo}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Generated By:</span>
                      <span className="ml-2 font-medium">{user?.fullName}</span>
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    {/* Daily Income Report */}
                    {selectedReport === 'daily' && (
                      <div className="space-y-4">
                        <h4 className="font-semibold text-heading">Daily Income Summary</h4>
                        
                        {/* Summary Cards */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                          <div className="p-4 rounded-md bg-muted">
                            <p className="text-sm text-muted-foreground">Total Revenue</p>
                            <p className="text-2xl font-bold text-primary">{formatCurrency(getTotalDailySales())}</p>
                          </div>
                          <div className="p-4 rounded-md bg-muted">
                            <p className="text-sm text-muted-foreground">Transactions</p>
                            <p className="text-2xl font-bold text-heading">{getTotalDailyTransactions()}</p>
                          </div>
                          <div className="p-4 rounded-md bg-muted">
                            <p className="text-sm text-muted-foreground">Avg. Daily Sales</p>
                            <p className="text-2xl font-bold text-heading">
                              {formatCurrency(dailySummaries.length > 0 ? getTotalDailySales() / dailySummaries.length : 0)}
                            </p>
                          </div>
                        </div>

                        {dailySummaries.length > 0 ? (
                          <table className="data-table w-full">
                            <thead>
                              <tr>
                                <th className="text-left p-2 border-b">Date</th>
                                <th className="text-right p-2 border-b">Transactions</th>
                                <th className="text-right p-2 border-b">Total Sales</th>
                                <th className="text-left p-2 border-b">Top Product</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dailySummaries.map((day) => (
                                <tr key={day.date} className="border-b">
                                  <td className="p-2">{format(new Date(day.date), 'MMM dd, yyyy')}</td>
                                  <td className="p-2 text-right">{day.transactionCount}</td>
                                  <td className="p-2 text-right font-medium">{formatCurrency(day.totalSales)}</td>
                                  <td className="p-2 text-muted-foreground">{day.topProduct}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-center text-muted-foreground py-8">No sales data for selected period</p>
                        )}
                      </div>
                    )}

                    {/* Monthly Income Report */}
                    {selectedReport === 'monthly' && (
                      <div className="space-y-4">
                        <h4 className="font-semibold text-heading">Monthly Income Summary (Last 6 Months)</h4>
                        
                        {monthlySummaries.length > 0 ? (
                          <>
                            <div className="grid grid-cols-2 gap-4 mb-6">
                              <div className="p-4 rounded-md bg-muted">
                                <p className="text-sm text-muted-foreground">Total Revenue (6 months)</p>
                                <p className="text-2xl font-bold text-primary">
                                  {formatCurrency(monthlySummaries.reduce((sum, m) => sum + m.totalSales, 0))}
                                </p>
                              </div>
                              <div className="p-4 rounded-md bg-muted">
                                <p className="text-sm text-muted-foreground">Monthly Average</p>
                                <p className="text-2xl font-bold text-heading">
                                  {formatCurrency(monthlySummaries.reduce((sum, m) => sum + m.totalSales, 0) / monthlySummaries.length)}
                                </p>
                              </div>
                            </div>

                            <table className="data-table w-full">
                              <thead>
                                <tr>
                                  <th className="text-left p-2 border-b">Month</th>
                                  <th className="text-right p-2 border-b">Transactions</th>
                                  <th className="text-right p-2 border-b">Total Sales</th>
                                  <th className="text-right p-2 border-b">Avg. Transaction</th>
                                  <th className="text-right p-2 border-b">Growth</th>
                                </tr>
                              </thead>
                              <tbody>
                                {monthlySummaries.map((month) => (
                                  <tr key={month.month} className="border-b">
                                    <td className="p-2 font-medium">{month.month}</td>
                                    <td className="p-2 text-right">{month.transactionCount}</td>
                                    <td className="p-2 text-right font-medium">{formatCurrency(month.totalSales)}</td>
                                    <td className="p-2 text-right">{formatCurrency(month.avgTransactionValue)}</td>
                                    <td className={`p-2 text-right ${month.growth !== null ? (month.growth >= 0 ? 'text-success' : 'text-destructive') : ''}`}>
                                      {month.growth !== null ? `${month.growth >= 0 ? '+' : ''}${month.growth.toFixed(1)}%` : '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </>
                        ) : (
                          <p className="text-center text-muted-foreground py-8">No sales data available</p>
                        )}
                      </div>
                    )}

                    {/* Inventory Report */}
                    {selectedReport === 'inventory' && (
                      <div className="space-y-4">
                        <h4 className="font-semibold text-heading">Inventory Summary by Category</h4>
                        
                        {inventorySummary.length > 0 ? (
                          <table className="data-table w-full">
                            <thead>
                              <tr>
                                <th className="text-left p-2 border-b">Category</th>
                                <th className="text-right p-2 border-b">Products</th>
                                <th className="text-right p-2 border-b">Total Stock</th>
                                <th className="text-right p-2 border-b">Valuation</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inventorySummary.map((cat) => (
                                <tr key={cat.category} className="border-b">
                                  <td className="p-2">{cat.category}</td>
                                  <td className="p-2 text-right">{cat.products}</td>
                                  <td className="p-2 text-right">{cat.totalStock} units</td>
                                  <td className="p-2 text-right font-medium">{formatCurrency(cat.valuation)}</td>
                                </tr>
                              ))}
                              <tr className="font-semibold bg-muted">
                                <td className="p-2">TOTAL</td>
                                <td className="p-2 text-right">{inventorySummary.reduce((s, c) => s + c.products, 0)}</td>
                                <td className="p-2 text-right">{inventorySummary.reduce((s, c) => s + c.totalStock, 0)} units</td>
                                <td className="p-2 text-right">{formatCurrency(inventorySummary.reduce((s, c) => s + c.valuation, 0))}</td>
                              </tr>
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-center text-muted-foreground py-8">No inventory data available</p>
                        )}
                      </div>
                    )}

                    {/* Sales Analysis Report */}
                    {selectedReport === 'sales' && (
                      <div className="space-y-4">
                        <h4 className="font-semibold text-heading">Sales Performance</h4>
                        <div className="grid grid-cols-3 gap-4 mb-6">
                          <div className="p-4 rounded-md bg-muted">
                            <p className="text-sm text-muted-foreground">Total Revenue</p>
                            <p className="text-2xl font-bold text-primary">{formatCurrency(salesData.totalRevenue)}</p>
                          </div>
                          <div className="p-4 rounded-md bg-muted">
                            <p className="text-sm text-muted-foreground">Transactions</p>
                            <p className="text-2xl font-bold text-heading">{salesData.transactions}</p>
                          </div>
                          <div className="p-4 rounded-md bg-muted">
                            <p className="text-sm text-muted-foreground">Avg. Transaction</p>
                            <p className="text-2xl font-bold text-heading">{formatCurrency(salesData.avgTransaction)}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Other reports placeholder */}
                    {['forecast', 'staff', 'financial'].includes(selectedReport) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="font-medium">Coming Soon</p>
                        <p className="text-sm mt-1">This report type is under development</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
