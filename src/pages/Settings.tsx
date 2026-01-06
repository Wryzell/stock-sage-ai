import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { mockUsers } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings as SettingsIcon, Users, Bell, Shield, Database, Brain, Plus, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('system');

  // Redirect staff users
  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const staffUsers = mockUsers.filter(u => u.role === 'staff');

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
            <div className="card-stock-sage animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-heading">Staff Users</h3>
                <Button className="gap-2" onClick={() => toast.info('Add user dialog would open')}>
                  <Plus size={18} />
                  Add Staff User
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Last Login</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffUsers.map((staffUser) => (
                      <tr key={staffUser.id}>
                        <td className="font-medium">{staffUser.fullName}</td>
                        <td>{staffUser.email}</td>
                        <td>
                          <span className={`status-badge ${
                            staffUser.status === 'active' ? 'status-success' : 'status-danger'
                          }`}>
                            {staffUser.status}
                          </span>
                        </td>
                        <td className="text-muted-foreground">
                          {new Date(staffUser.lastLogin).toLocaleString()}
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit2 size={16} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-danger hover:text-danger">
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
