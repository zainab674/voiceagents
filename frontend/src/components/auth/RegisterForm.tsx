import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { WHITELABEL_ENDPOINT } from '@/constants/URLConstant';
import { extractTenantFromHostname } from '@/lib/tenant-utils';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [accountType, setAccountType] = useState<'customer' | 'whitelabel'>('customer');
  const [slug, setSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [slugMessage, setSlugMessage] = useState('');
  const slugCheckTimeout = useRef<NodeJS.Timeout | null>(null);

  const { register } = useAuth();
  const navigate = useNavigate();
  const isWhiteLabel = accountType === 'whitelabel';
  
  // Check if user is on a whitelabel domain
  const [isOnWhitelabelDomain, setIsOnWhitelabelDomain] = useState(false);

  // Check if on whitelabel domain on mount
  useEffect(() => {
    const tenant = extractTenantFromHostname();
    const isWhitelabel = tenant !== 'main';
    setIsOnWhitelabelDomain(isWhitelabel);
    
    // If on whitelabel domain, force account type to customer
    if (isWhitelabel) {
      setAccountType('customer');
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('First name and last name are required');
      return false;
    }

    if (isWhiteLabel) {
      if (!slug.trim()) {
        setError('Slug is required for white label accounts');
        return false;
      }

      if (slugStatus !== 'valid') {
        setError(slugStatus === 'checking'
          ? 'Please wait while we verify your slug'
          : 'Slug is not available. Please choose another one.');
        return false;
      }
    }

    return true;
  };

  useEffect(() => {
    if (!isWhiteLabel) {
      setSlug('');
      setSlugStatus('idle');
      setSlugMessage('');
      return;
    }

    if (slugCheckTimeout.current) {
      window.clearTimeout(slugCheckTimeout.current);
    }

    if (!slug.trim()) {
      setSlugStatus('idle');
      setSlugMessage('');
      return;
    }

    setSlugStatus('checking');
    setSlugMessage('Checking availability...');

    slugCheckTimeout.current = setTimeout(async () => {
      try {
        const response = await fetch(`${WHITELABEL_ENDPOINT}/check-slug-available`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ slug: slug.trim().toLowerCase() })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setSlugStatus('valid');
          setSlugMessage(data.message || 'Slug is available!');
        } else {
          setSlugStatus('invalid');
          setSlugMessage(data.message || 'Slug is already taken');
        }
      } catch (err) {
        console.error('Error checking slug availability', err);
        setSlugStatus('invalid');
        setSlugMessage('Unable to verify slug. Please try again.');
      }
    }, 600);

    return () => {
      if (slugCheckTimeout.current) {
        window.clearTimeout(slugCheckTimeout.current);
      }
    };
  }, [slug, isWhiteLabel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    try {
      // Store signup data in localStorage for onboarding
      const signupData = {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone || undefined,
        whitelabel: isWhiteLabel,
        slug: isWhiteLabel ? slug.trim().toLowerCase() : undefined
      };

      localStorage.setItem('signup-data', JSON.stringify(signupData));

      // Navigate to onboarding instead of registering immediately
      navigate('/onboarding');
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Create account</CardTitle>
        <CardDescription className="text-center">
          Enter your information to create a new account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isOnWhitelabelDomain && (
            <div className="space-y-2">
              <Label>Account Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={accountType === 'customer' ? 'default' : 'outline'}
                  onClick={() => setAccountType('customer')}
                  disabled={loading}
                >
                  Customer
                </Button>
                <Button
                  type="button"
                  variant={accountType === 'whitelabel' ? 'default' : 'outline'}
                  onClick={() => setAccountType('whitelabel')}
                  disabled={loading}
                >
                  White Label
                </Button>
              </div>
              {accountType === 'whitelabel' && (
                <p className="text-xs text-muted-foreground">
                  Create a branded experience on your own subdomain.
                </p>
              )}
            </div>
          )}

          {isWhiteLabel && (
            <div className="space-y-2">
              <Label htmlFor="slug">White Label Slug</Label>
              <Input
                id="slug"
                name="slug"
                type="text"
                placeholder="e.g. acme"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                disabled={loading}
              />
              {slugMessage && (
                <p
                  className={`text-xs ${
                    slugStatus === 'valid'
                      ? 'text-emerald-600'
                      : slugStatus === 'invalid'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }`}
                >
                  {slugMessage}
                </p>
              )}
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                name="firstName"
                type="text"
                placeholder="First name"
                value={formData.firstName}
                onChange={handleInputChange}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                name="lastName"
                type="text"
                placeholder="Last name"
                value={formData.lastName}
                onChange={handleInputChange}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleInputChange}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone (Optional)</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="Enter your phone number"
              value={formData.phone}
              onChange={handleInputChange}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                value={formData.password}
                onChange={handleInputChange}
                required
                disabled={loading}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                disabled={loading}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create account'
            )}
          </Button>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Already have an account? </span>
            <Button
              type="button"
              variant="link"
              className="p-0 h-auto font-semibold"
              onClick={onSwitchToLogin}
              disabled={loading}
            >
              Sign in
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
