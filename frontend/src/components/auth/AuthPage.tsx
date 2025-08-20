import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

export const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect to dashboard if user is already authenticated
  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render auth forms if user is authenticated
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Voice Assistant</h1>
          <p className="text-gray-600">Your AI-powered communication companion</p>
        </div>
        
        {isLogin ? (
          <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
        ) : (
          <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
        )}
        
        <div className="mt-8 text-center">
          <Card className="bg-white/50 backdrop-blur-sm">
            <CardContent className="pt-6">
              <CardDescription className="text-sm text-gray-600">
                Secure authentication powered by Supabase
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
