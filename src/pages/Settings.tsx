import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings as SettingsIcon, Users, Database, ClipboardList, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { UserManagement } from '@/components/UserManagement';
import { AuditLogs } from '@/components/AuditLogs';
import { RecycleBin } from '@/components/RecycleBin';

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('system');

  // Redirect staff users
  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

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
            <TabsTrigger value="users" className="gap-2">
              <Users size={16} />
              Users
            </TabsTrigger>
            <TabsTrigger value="recycle" className="gap-2">
              <Trash2 size={16} />
              Recycle Bin
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <ClipboardList size={16} />
              Audit Logs
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


          {/* User Management */}
          <TabsContent value="users" className="space-y-6">
            <UserManagement />
          </TabsContent>



          {/* Recycle Bin */}
          <TabsContent value="recycle" className="space-y-6">
            <div className="card-stock-sage animate-fade-in">
              <RecycleBin />
            </div>
          </TabsContent>

          {/* Audit Logs */}
          <TabsContent value="audit" className="space-y-6">
            <div className="card-stock-sage animate-fade-in">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-heading">User Activity Logs</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Track all user actions including product and sales additions, deletions, and modifications.
                </p>
              </div>
              <AuditLogs />
            </div>
          </TabsContent>

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
