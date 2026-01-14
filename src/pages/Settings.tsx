import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings as SettingsIcon, Users, Bell, Shield, Database, Brain, FileSpreadsheet, Upload, Download, Loader2, Package, ShoppingCart, TrendingUp, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { UserManagement } from '@/components/UserManagement';

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('system');
  const [exporting, setExporting] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect staff users
  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // Export functions
  const exportProducts = async () => {
    setExporting('products');
    try {
      const { data, error } = await supabase.from('products').select('*');
      if (error) throw error;
      
      const worksheet = XLSX.utils.json_to_sheet(data || []);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
      XLSX.writeFile(workbook, `products_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Products exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export products');
    } finally {
      setExporting(null);
    }
  };

  const exportSales = async () => {
    setExporting('sales');
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*, products(name)')
        .order('sale_date', { ascending: false });
      if (error) throw error;
      
      const formattedData = data?.map(sale => ({
        ...sale,
        product_name: sale.products?.name || 'Unknown',
        products: undefined
      })) || [];
      
      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales');
      XLSX.writeFile(workbook, `sales_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Sales exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export sales');
    } finally {
      setExporting(null);
    }
  };

  const exportForecasts = async () => {
    setExporting('forecasts');
    try {
      const { data, error } = await supabase.from('forecasts').select('*');
      if (error) throw error;
      
      const worksheet = XLSX.utils.json_to_sheet(data || []);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Forecasts');
      XLSX.writeFile(workbook, `forecasts_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Forecasts exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export forecasts');
    } finally {
      setExporting(null);
    }
  };

  const exportAlerts = async () => {
    setExporting('alerts');
    try {
      const { data, error } = await supabase.from('alerts').select('*');
      if (error) throw error;
      
      const worksheet = XLSX.utils.json_to_sheet(data || []);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Alerts');
      XLSX.writeFile(workbook, `alerts_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('Alerts exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export alerts');
    } finally {
      setExporting(null);
    }
  };

  const exportAll = async () => {
    setExporting('all');
    try {
      const workbook = XLSX.utils.book_new();
      
      // Products
      const { data: products } = await supabase.from('products').select('*');
      if (products) {
        const ws1 = XLSX.utils.json_to_sheet(products);
        XLSX.utils.book_append_sheet(workbook, ws1, 'Products');
      }
      
      // Sales
      const { data: sales } = await supabase.from('sales').select('*, products(name)');
      if (sales) {
        const formattedSales = sales.map(s => ({ ...s, product_name: s.products?.name, products: undefined }));
        const ws2 = XLSX.utils.json_to_sheet(formattedSales);
        XLSX.utils.book_append_sheet(workbook, ws2, 'Sales');
      }
      
      // Forecasts
      const { data: forecasts } = await supabase.from('forecasts').select('*');
      if (forecasts) {
        const ws3 = XLSX.utils.json_to_sheet(forecasts);
        XLSX.utils.book_append_sheet(workbook, ws3, 'Forecasts');
      }
      
      // Alerts
      const { data: alerts } = await supabase.from('alerts').select('*');
      if (alerts) {
        const ws4 = XLSX.utils.json_to_sheet(alerts);
        XLSX.utils.book_append_sheet(workbook, ws4, 'Alerts');
      }
      
      XLSX.writeFile(workbook, `stock_sage_backup_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success('All data exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    } finally {
      setExporting(null);
    }
  };

  // Import function
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      
      let importedCount = 0;
      
      // Check for Products sheet
      if (workbook.SheetNames.includes('Products')) {
        const sheet = workbook.Sheets['Products'];
        const products = XLSX.utils.sheet_to_json(sheet) as any[];
        
        for (const product of products) {
          // Skip if product has an ID (existing product)
          if (product.id) continue;
          
          const { error } = await supabase.from('products').insert({
            name: product.name,
            sku: product.sku,
            category: product.category || 'General',
            description: product.description,
            current_stock: parseInt(product.current_stock) || 0,
            min_stock: parseInt(product.min_stock) || 10,
            cost_price: parseFloat(product.cost_price) || 0,
            selling_price: parseFloat(product.selling_price) || 0,
            status: product.status || 'in_stock'
          });
          
          if (!error) importedCount++;
        }
      }
      
      // Check for Sales sheet
      if (workbook.SheetNames.includes('Sales')) {
        const sheet = workbook.Sheets['Sales'];
        const sales = XLSX.utils.sheet_to_json(sheet) as any[];
        
        for (const sale of sales) {
          if (sale.id || !sale.product_id) continue;
          
          const { error } = await supabase.from('sales').insert({
            product_id: sale.product_id,
            quantity: parseInt(sale.quantity) || 1,
            unit_price: parseFloat(sale.unit_price) || 0,
            total: parseFloat(sale.total) || 0,
            sale_date: sale.sale_date || new Date().toISOString()
          });
          
          if (!error) importedCount++;
        }
      }
      
      if (importedCount > 0) {
        toast.success(`Successfully imported ${importedCount} records`);
      } else {
        toast.info('No new records to import. Make sure new items don\'t have an ID field.');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import file. Please check the format.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-heading">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure system settings and manage users
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted p-1">
            <TabsTrigger value="system" className="gap-2">
              <SettingsIcon size={16} />
              System
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Brain size={16} />
              AI Settings
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users size={16} />
              Users
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell size={16} />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield size={16} />
              Security
            </TabsTrigger>
            <TabsTrigger value="data" className="gap-2">
              <FileSpreadsheet size={16} />
              Import/Export
            </TabsTrigger>
            <TabsTrigger value="backup" className="gap-2">
              <Database size={16} />
              Backup
            </TabsTrigger>
          </TabsList>

          {/* System Configuration */}
          <TabsContent value="system" className="space-y-6">
            <div className="card-stock-sage animate-fade-in">
              <h3 className="text-lg font-semibold text-heading mb-4">Company Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input defaultValue="Sumtech Enterprises" />
                </div>
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input type="email" defaultValue="admin@sumtech.com" />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input defaultValue="+63 917 123 4567" />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input defaultValue="Makati City, Philippines" />
                </div>
              </div>
            </div>

            <div className="card-stock-sage animate-fade-in">
              <h3 className="text-lg font-semibold text-heading mb-4">Regional Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select defaultValue="PHP">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PHP">Philippine Peso (₱)</SelectItem>
                      <SelectItem value="USD">US Dollar ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date Format</Label>
                  <Select defaultValue="MM/DD/YYYY">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select defaultValue="Asia/Manila">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Manila">Asia/Manila (UTC+8)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="mt-6" onClick={() => toast.success('Settings saved')}>
                Save Changes
              </Button>
            </div>
          </TabsContent>

          {/* AI Settings */}
          <TabsContent value="ai" className="space-y-6">
            <div className="card-stock-sage animate-fade-in">
              <h3 className="text-lg font-semibold text-heading mb-4">Forecasting Parameters</h3>
              <p className="text-muted-foreground mb-4">
                The system uses Exponential Smoothing algorithm for demand prediction.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Default Forecast Period</Label>
                  <Select defaultValue="30">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 Days</SelectItem>
                      <SelectItem value="60">60 Days</SelectItem>
                      <SelectItem value="90">90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Training Data Window</Label>
                  <Select defaultValue="6">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 Months</SelectItem>
                      <SelectItem value="6">6 Months</SelectItem>
                      <SelectItem value="12">12 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="card-stock-sage animate-fade-in">
              <h3 className="text-lg font-semibold text-heading mb-4">Alert Thresholds</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Low Stock Warning (%)</Label>
                  <Input type="number" defaultValue={20} min={5} max={50} />
                  <p className="text-xs text-muted-foreground">Trigger alert when stock falls below this % of minimum</p>
                </div>
                <div className="space-y-2">
                  <Label>Stockout Risk Days</Label>
                  <Input type="number" defaultValue={7} min={1} max={30} />
                  <p className="text-xs text-muted-foreground">Alert when stockout predicted within this many days</p>
                </div>
              </div>
              <Button className="mt-6" onClick={() => toast.success('AI settings saved')}>
                Save AI Settings
              </Button>
            </div>
          </TabsContent>

          {/* User Management */}
          <TabsContent value="users" className="space-y-6">
            <UserManagement />
          </TabsContent>

          {/* Notifications */}
          <TabsContent value="notifications" className="space-y-6">
            <div className="card-stock-sage animate-fade-in">
              <h3 className="text-lg font-semibold text-heading mb-4">Email Notifications</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-md border border-border">
                  <div>
                    <p className="font-medium">Low Stock Alerts</p>
                    <p className="text-sm text-muted-foreground">Receive email when stock falls below minimum</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-4 rounded-md border border-border">
                  <div>
                    <p className="font-medium">Daily Summary</p>
                    <p className="text-sm text-muted-foreground">Receive daily inventory and sales summary</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-4 rounded-md border border-border">
                  <div>
                    <p className="font-medium">Forecast Updates</p>
                    <p className="text-sm text-muted-foreground">Get notified when new forecasts are generated</p>
                  </div>
                  <Switch />
                </div>
              </div>
              <Button className="mt-6" onClick={() => toast.success('Notification settings saved')}>
                Save Preferences
              </Button>
            </div>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security" className="space-y-6">
            <div className="card-stock-sage animate-fade-in">
              <h3 className="text-lg font-semibold text-heading mb-4">Password Policy</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-md border border-border">
                  <div>
                    <p className="font-medium">Minimum Length</p>
                    <p className="text-sm text-muted-foreground">Required password length</p>
                  </div>
                  <Input type="number" className="w-20" defaultValue={8} min={6} max={20} />
                </div>
                <div className="flex items-center justify-between p-4 rounded-md border border-border">
                  <div>
                    <p className="font-medium">Require Special Characters</p>
                    <p className="text-sm text-muted-foreground">Password must contain special characters</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-4 rounded-md border border-border">
                  <div>
                    <p className="font-medium">Password Expiry (Days)</p>
                    <p className="text-sm text-muted-foreground">Force password change after this period</p>
                  </div>
                  <Input type="number" className="w-20" defaultValue={90} min={30} max={365} />
                </div>
              </div>
            </div>

            <div className="card-stock-sage animate-fade-in">
              <h3 className="text-lg font-semibold text-heading mb-4">Session Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-md border border-border">
                  <div>
                    <p className="font-medium">Session Timeout (Minutes)</p>
                    <p className="text-sm text-muted-foreground">Auto-logout after inactivity</p>
                  </div>
                  <Input type="number" className="w-20" defaultValue={30} min={5} max={120} />
                </div>
              </div>
              <Button className="mt-6" onClick={() => toast.success('Security settings saved')}>
                Save Security Settings
              </Button>
            </div>
          </TabsContent>

          {/* Import/Export Data */}
          <TabsContent value="data" className="space-y-6" forceMount style={{ display: activeTab === 'data' ? 'block' : 'none' }}>
            {/* Export Section */}
            <div className="card-stock-sage animate-fade-in">
              <h3 className="text-lg font-semibold text-heading mb-2">Export Data</h3>
              <p className="text-muted-foreground mb-4">
                Download your data as Excel files for backup or analysis.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-md border border-border hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <Package size={20} className="text-primary" />
                    <h4 className="font-medium">Products</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">Export all products with stock levels and pricing</p>
                  <Button variant="outline" size="sm" onClick={exportProducts} disabled={!!exporting} className="gap-2">
                    {exporting === 'products' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    Export Products
                  </Button>
                </div>
                
                <div className="p-4 rounded-md border border-border hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <ShoppingCart size={20} className="text-primary" />
                    <h4 className="font-medium">Sales</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">Export all sales transactions with product details</p>
                  <Button variant="outline" size="sm" onClick={exportSales} disabled={!!exporting} className="gap-2">
                    {exporting === 'sales' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    Export Sales
                  </Button>
                </div>
                
                <div className="p-4 rounded-md border border-border hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp size={20} className="text-primary" />
                    <h4 className="font-medium">Forecasts</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">Export all AI-generated demand forecasts</p>
                  <Button variant="outline" size="sm" onClick={exportForecasts} disabled={!!exporting} className="gap-2">
                    {exporting === 'forecasts' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    Export Forecasts
                  </Button>
                </div>
                
                <div className="p-4 rounded-md border border-border hover:border-primary/50 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle size={20} className="text-primary" />
                    <h4 className="font-medium">Alerts</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">Export all inventory alerts and warnings</p>
                  <Button variant="outline" size="sm" onClick={exportAlerts} disabled={!!exporting} className="gap-2">
                    {exporting === 'alerts' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    Export Alerts
                  </Button>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-border">
                <Button onClick={exportAll} disabled={!!exporting} className="gap-2">
                  {exporting === 'all' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  Export All Data
                </Button>
              </div>
            </div>
            
            {/* Import Section */}
            <div className="card-stock-sage animate-fade-in">
              <h3 className="text-lg font-semibold text-heading mb-2">Import Data</h3>
              <p className="text-muted-foreground mb-4">
                Upload an Excel file to import new products or sales. The file should have sheets named "Products" or "Sales".
              </p>
              
              <div className="p-6 border-2 border-dashed border-border rounded-lg text-center">
                <Upload size={40} className="mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  Click to upload or drag and drop an Excel file (.xlsx)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleImport}
                  className="hidden"
                  id="excel-import"
                />
                <Button 
                  variant="outline" 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="gap-2"
                >
                  {importing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                  {importing ? 'Importing...' : 'Choose File'}
                </Button>
              </div>
              
              <div className="mt-4 p-4 bg-muted/50 rounded-md">
                <h4 className="text-sm font-medium mb-2">Import Format Guidelines</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Products sheet:</strong> name, sku, category, current_stock, min_stock, cost_price, selling_price</li>
                  <li>• <strong>Sales sheet:</strong> product_id, quantity, unit_price, total, sale_date</li>
                  <li>• New items should NOT have an "id" column (IDs are auto-generated)</li>
                  <li>• Existing items (with ID) will be skipped to prevent duplicates</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          {/* Backup */}
          <TabsContent value="backup" className="space-y-6">
            <div className="card-stock-sage animate-fade-in">
              <h3 className="text-lg font-semibold text-heading mb-4">Manual Backup</h3>
              <p className="text-muted-foreground mb-4">
                Create a backup of all inventory data, transactions, and settings.
              </p>
              <Button onClick={() => toast.success('Backup created successfully')} className="gap-2">
                <Database size={18} />
                Create Backup Now
              </Button>
            </div>

            <div className="card-stock-sage animate-fade-in">
              <h3 className="text-lg font-semibold text-heading mb-4">Auto-Backup Schedule</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-md border border-border">
                  <div>
                    <p className="font-medium">Enable Auto-Backup</p>
                    <p className="text-sm text-muted-foreground">Automatically backup data on schedule</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="space-y-2">
                  <Label>Backup Frequency</Label>
                  <Select defaultValue="daily">
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button className="mt-6" onClick={() => toast.success('Backup schedule saved')}>
                Save Schedule
              </Button>
            </div>

            <div className="card-stock-sage animate-fade-in">
              <h3 className="text-lg font-semibold text-heading mb-4">Recent Backups</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Dec 29, 2024 08:00 AM</td>
                    <td>Automatic</td>
                    <td>12.5 MB</td>
                    <td><span className="status-badge status-success">Complete</span></td>
                  </tr>
                  <tr>
                    <td>Dec 28, 2024 08:00 AM</td>
                    <td>Automatic</td>
                    <td>12.3 MB</td>
                    <td><span className="status-badge status-success">Complete</span></td>
                  </tr>
                  <tr>
                    <td>Dec 27, 2024 08:00 AM</td>
                    <td>Automatic</td>
                    <td>12.1 MB</td>
                    <td><span className="status-badge status-success">Complete</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
