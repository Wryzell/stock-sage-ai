import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Download, Printer, Calendar, BarChart3, TrendingUp, Users, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

import { LucideIcon } from 'lucide-react';

interface ReportType {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const reportTypes: ReportType[] = [
  { id: 'inventory', name: 'Inventory Summary', description: 'Current stock levels and valuation', icon: BarChart3 },
  { id: 'sales', name: 'Sales Analysis', description: 'Sales performance and trends', icon: TrendingUp },
  { id: 'forecast', name: 'Forecast Accuracy', description: 'AI prediction accuracy metrics', icon: BarChart3, adminOnly: true },
  { id: 'staff', name: 'Staff Activity', description: 'User actions and transactions', icon: Users, adminOnly: true },
  { id: 'financial', name: 'Financial Summary', description: 'Revenue, costs, and margins', icon: DollarSign, adminOnly: true },
];

export default function Reports() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  
  const [selectedReport, setSelectedReport] = useState<string>('inventory');
  const [dateFrom, setDateFrom] = useState('2024-12-01');
  const [dateTo, setDateTo] = useState('2024-12-29');

  const availableReports = isSuperAdmin 
    ? reportTypes 
    : reportTypes.filter(r => !r.adminOnly);

  const handleGenerate = () => {
    toast.success('Report generated successfully');
  };

  const handleExport = (format: 'excel' | 'pdf') => {
    toast.success(`Exporting report as ${format.toUpperCase()}...`);
  };

  const handlePrint = () => {
    toast.success('Preparing report for printing...');
  };

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
            {isSuperAdmin && (
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
                  <div className="space-y-2">
                    <Label>Category Filter</Label>
                    <Select defaultValue="all">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="laptops">Laptops</SelectItem>
                        <SelectItem value="accessories">Accessories</SelectItem>
                        <SelectItem value="peripherals">Peripherals</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <Button onClick={handleGenerate} className="gap-2">
                    <FileText size={18} />
                    Generate Report
                  </Button>
                </div>
              </div>
            )}

            {/* Report Preview */}
            <div className="card-stock-sage animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-heading">
                  {availableReports.find(r => r.id === selectedReport)?.name} Report
                </h3>
                <div className="flex gap-2">
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

              {/* Sample Report Content */}
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
                      <span className="ml-2 font-medium">{new Date().toLocaleDateString()}</span>
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

                {selectedReport === 'inventory' && (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-heading">Inventory Summary</h4>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Products</th>
                          <th>Total Stock</th>
                          <th>Valuation</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Laptops</td>
                          <td>2</td>
                          <td>19 units</td>
                          <td>₱1,368,000</td>
                        </tr>
                        <tr>
                          <td>Accessories</td>
                          <td>4</td>
                          <td>97 units</td>
                          <td>₱291,000</td>
                        </tr>
                        <tr>
                          <td>Peripherals</td>
                          <td>1</td>
                          <td>8 units</td>
                          <td>₱34,392</td>
                        </tr>
                        <tr>
                          <td>Monitors</td>
                          <td>1</td>
                          <td>10 units</td>
                          <td>₱289,990</td>
                        </tr>
                        <tr className="font-semibold bg-muted">
                          <td>TOTAL</td>
                          <td>15</td>
                          <td>187 units</td>
                          <td>₱2,845,230</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {selectedReport === 'sales' && (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-heading">Sales Performance</h4>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="p-4 rounded-md bg-muted">
                        <p className="text-sm text-muted-foreground">Total Revenue</p>
                        <p className="text-2xl font-bold text-primary">₱312,983</p>
                      </div>
                      <div className="p-4 rounded-md bg-muted">
                        <p className="text-sm text-muted-foreground">Transactions</p>
                        <p className="text-2xl font-bold text-heading">5</p>
                      </div>
                      <div className="p-4 rounded-md bg-muted">
                        <p className="text-sm text-muted-foreground">Avg. Transaction</p>
                        <p className="text-2xl font-bold text-heading">₱62,597</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
