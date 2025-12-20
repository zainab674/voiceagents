import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

import { ForgotPasswordForm } from './ForgotPasswordForm';
import { ResetPasswordForm } from './ResetPasswordForm';

export const AuthPage: React.FC = () => {
  const [view, setView] = useState<'login' | 'register' | 'forgot-password' | 'reset-password'>('login');
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Check for reset password mode on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    if (params.get('reset') === 'true' || hash.includes('type=recovery')) {
      setView('reset-password');
    }
  }, []);

  // Redirect to dashboard if user is already authenticated (but not in reset mode)
  useEffect(() => {
    if (!loading && user && view !== 'reset-password') {
      navigate('/dashboard');
    }
  }, [user, loading, navigate, view]);

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

  // Don't render auth forms if user is authenticated (unless in reset mode)
  if (user && view !== 'reset-password') {
    return null;
  }

  const renderForm = () => {
    switch (view) {
      case 'login':
        return (
          <LoginForm
            onSwitchToRegister={() => setView('register')}
            onSwitchToForgotPassword={() => setView('forgot-password')}
          />
        );
      case 'register':
        return <RegisterForm onSwitchToLogin={() => setView('login')} />;
      case 'forgot-password':
        return <ForgotPasswordForm onSwitchToLogin={() => setView('login')} />;
      case 'reset-password':
        return <ResetPasswordForm />;
      default:
        return <LoginForm onSwitchToRegister={() => setView('register')} onSwitchToForgotPassword={() => setView('forgot-password')} />;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Voice Assistant</h1>
          <p className="text-gray-600">Your AI-powered communication companion</p>
        </div>

        {renderForm()}

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
