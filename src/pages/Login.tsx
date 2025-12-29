import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { UserRole } from '@/types';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    const success = await login(email, password, role);
    
    if (success) {
      toast.success('Login successful');
      navigate('/dashboard');
    } else {
      toast.error('Invalid credentials. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card-stock-sage border-2 border-primary/20 animate-fade-in">
          <div className="text-center mb-8">
            <Logo size="lg" showTagline />
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-3">
              <Label>Login As</Label>
              <RadioGroup
                value={role}
                onValueChange={(value) => setRole(value as UserRole)}
                className="flex gap-4"
                disabled={isLoading}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="super_admin" id="super_admin" />
                  <Label htmlFor="super_admin" className="font-normal cursor-pointer">
                    Super Admin
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="staff" id="staff" />
                  <Label htmlFor="staff" className="font-normal cursor-pointer">
                    Staff
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground text-center mb-4">Demo Credentials</p>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-md bg-muted">
                <p className="font-medium text-heading">Super Admin</p>
                <p className="text-muted-foreground mt-1">admin@demo.com</p>
                <p className="text-muted-foreground">demo123</p>
              </div>
              <div className="p-3 rounded-md bg-muted">
                <p className="font-medium text-heading">Staff</p>
                <p className="text-muted-foreground mt-1">staff@demo.com</p>
                <p className="text-muted-foreground">staff123</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
