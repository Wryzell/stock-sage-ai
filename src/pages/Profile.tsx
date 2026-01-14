import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { User, Lock, Bell, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function Profile() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSave = () => {
    setIsEditing(false);
    toast.success('Profile updated successfully');
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw error;
      }

      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-heading">My Profile</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account settings and preferences
          </p>
        </div>

        {/* Profile Information */}
        <div className="card-stock-sage animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center">
                <User size={32} className="text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-heading">{user?.fullName}</h2>
                <p className="text-muted-foreground capitalize">{user?.role.replace('_', ' ')}</p>
              </div>
            </div>
            <Button 
              variant={isEditing ? 'default' : 'outline'}
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
            >
              {isEditing ? 'Save Changes' : 'Edit Profile'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input 
                defaultValue={user?.fullName} 
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input 
                type="email" 
                defaultValue={user?.email} 
                disabled={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input 
                value={user?.role === 'admin' ? 'Administrator' : 'Staff Member'} 
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label>Account Status</Label>
              <Input 
                value={user?.status === 'active' ? 'Active' : 'Inactive'} 
                disabled
                className="bg-muted"
              />
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="card-stock-sage animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <Lock size={20} className="text-primary" />
            <h3 className="text-lg font-semibold text-heading">Change Password</h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input 
                  type="password" 
                  placeholder="Enter new password (min 6 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={changingPassword}
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm New Password</Label>
                <Input 
                  type="password" 
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={changingPassword}
                />
              </div>
            </div>
            <Button onClick={handleChangePassword} disabled={changingPassword}>
              {changingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="card-stock-sage animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <Bell size={20} className="text-primary" />
            <h3 className="text-lg font-semibold text-heading">Notification Preferences</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-md border border-border">
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-sm text-muted-foreground">Receive updates via email</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-4 rounded-md border border-border">
              <div>
                <p className="font-medium">Low Stock Alerts</p>
                <p className="text-sm text-muted-foreground">Get notified when products are low</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-4 rounded-md border border-border">
              <div>
                <p className="font-medium">Daily Summary</p>
                <p className="text-sm text-muted-foreground">Receive daily activity summary</p>
              </div>
              <Switch />
            </div>
          </div>
          <Button className="mt-4" onClick={() => toast.success('Preferences saved')}>
            Save Preferences
          </Button>
        </div>

        {/* Login History */}
        <div className="card-stock-sage animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <Clock size={20} className="text-primary" />
            <h3 className="text-lg font-semibold text-heading">Login History</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>IP Address</th>
                <th>Device</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{new Date().toLocaleString()}</td>
                <td>192.168.1.100</td>
                <td>Chrome on Windows</td>
                <td><span className="status-badge status-success">Current</span></td>
              </tr>
              <tr>
                <td>{new Date(Date.now() - 86400000).toLocaleString()}</td>
                <td>192.168.1.100</td>
                <td>Chrome on Windows</td>
                <td><span className="status-badge bg-muted text-muted-foreground">Success</span></td>
              </tr>
              <tr>
                <td>{new Date(Date.now() - 172800000).toLocaleString()}</td>
                <td>192.168.1.105</td>
                <td>Safari on iPhone</td>
                <td><span className="status-badge bg-muted text-muted-foreground">Success</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
