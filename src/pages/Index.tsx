import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Login from './Login';

const Index = () => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Login />;
};

export default Index;
