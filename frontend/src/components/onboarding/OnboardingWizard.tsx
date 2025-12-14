import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Progress } from '../ui/progress';
import { ArrowRight, ArrowLeft, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { planApi } from '../../http/planHttp';
import { paymentApi } from '../../http/paymentHttp';
import { extractTenantFromHostname } from '../../lib/tenant-utils';
import { useToast } from '../../hooks/use-toast';

const STEPS = [
  { id: 'company', title: 'Company Information' },
  { id: 'useCase', title: 'Use Case' },
  { id: 'plan', title: 'Choose Plan' },
  { id: 'complete', title: 'Complete' }
];

export const OnboardingWizard: React.FC = () => {
  const navigate = useNavigate();
  const { data, updateData, complete } = useOnboarding();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [availableMinutes, setAvailableMinutes] = useState<{ available: number | null; totalLimit: number | null; allocated: number } | null>(null);
  const [checkingMinutes, setCheckingMinutes] = useState(false);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Check if on whitelabel domain
  const isWhitelabelDomain = () => {
    const tenant = extractTenantFromHostname();
    return tenant !== 'main';
  };

  // Fetch available minutes for whitelabel domain
  useEffect(() => {
    const checkMinutes = async () => {
      if (!isWhitelabelDomain() || currentStep < 2) {
        return;
      }

      try {
        setCheckingMinutes(true);
        const response = await planApi.checkAvailableMinutes();
        if (response.success) {
          setAvailableMinutes(response.data);
        }
      } catch (error) {
        console.error('Error checking available minutes:', error);
        // Don't block plan selection if check fails
      } finally {
        setCheckingMinutes(false);
      }
    };

    checkMinutes();
  }, [currentStep]);

  // Fetch plans from API
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setPlansLoading(true);
        const response = await planApi.getAllPlans();
        if (response.success && response.data?.plans) {
          // Filter out plans with 0 price (free plans) and sort by price
          const availablePlans = response.data.plans
            .filter(plan => plan.price > 0)
            .sort((a, b) => a.price - b.price);
          setPlans(availablePlans);
        } else {
          // Fallback to empty array if API fails
          setPlans([]);
        }
      } catch (error) {
        console.error('Error fetching plans:', error);
        // Fallback to empty array on error
        setPlans([]);
      } finally {
        setPlansLoading(false);
      }
    };

    // Only fetch plans when we're on the plan selection step or about to be
    if (currentStep >= 2) {
      fetchPlans();
    }
  }, [currentStep]);

  // Handle plan selection with validation and payment
  const handlePlanSelect = async (planKey: string) => {
    const selectedPlan = plans.find(p => p.plan_key === planKey);
    if (!selectedPlan) {
      return;
    }

    // Check if on whitelabel domain and if there are enough minutes
    if (isWhitelabelDomain() && availableMinutes && availableMinutes.available !== null) {
      const planMinutes = selectedPlan.minutes_limit || 0;

      // Prevent unlimited plans for limited admins
      if (planMinutes === 0) {
        toast({
          title: "Plan Not Available",
          description: "This plan is not available. Please contact your administrator.",
          variant: "destructive"
        });
        return;
      }

      // Check if there are enough available minutes
      if (planMinutes > availableMinutes.available) {
        toast({
          title: "Insufficient Minutes",
          description: "Your administrator does not have enough minutes available for this plan. Please contact your administrator.",
          variant: "destructive"
        });
        return;
      }
    }

    updateData({ plan: planKey });
  };

  const handleComplete = async () => {
    try {
      // Get signup data from localStorage
      const signupDataStr = localStorage.getItem('signup-data');

      if (!signupDataStr) {
        navigate('/auth');
        return;
      }

      const signupData = JSON.parse(signupDataStr);
      const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

      // Validate plan selection for whitelabel domains
      if (isWhitelabelDomain() && data.plan) {
        const selectedPlan = plans.find(p => p.plan_key === data.plan);
        if (selectedPlan && availableMinutes && availableMinutes.available !== null) {
          const planMinutes = selectedPlan.minutes_limit || 0;

          if (planMinutes === 0) {
            toast({
              title: "Plan Not Available",
              description: "This plan is not available. Please contact your administrator.",
              variant: "destructive"
            });
            return;
          }

          if (planMinutes > availableMinutes.available) {
            toast({
              title: "Insufficient Minutes",
              description: "Your administrator does not have enough minutes available for this plan. Please contact your administrator.",
              variant: "destructive"
            });
            return;
          }
        }
      }

      // If plan has a price > 0, redirect to Stripe Checkout
      const selectedPlan = plans.find(p => p.plan_key === data.plan);
      if (selectedPlan && selectedPlan.price > 0) {
        toast({
          title: "Redirecting to Payment",
          description: "Please wait while we redirect you to the secure checkout page...",
        });

        // Save current onboarding state to restore after payment if needed
        localStorage.setItem('onboarding-state', JSON.stringify(data));

        try {
          const checkoutSession = await paymentApi.createCheckoutSession({
            planKey: data.plan,
            successUrl: `${window.location.origin}/auth?registered=true&payment=success`,
            cancelUrl: window.location.href, // Return here on cancel
            customerEmail: signupData.email,
            // Pass temp user data if needed, or we register after success?
            // Strategy: We can register the user NOW, but mark as inactive?
            // OR pass metadata to Stripe and register in webhook?
            // Simpler approach for now: Register User FIRST, then redirect to pay.
            // If they cancel payment, they have an account but no active sub.
          });

          // Register user first
          const tenantFromDomain = extractTenantFromHostname();
          const requestedTenant = tenantFromDomain !== 'main' ? tenantFromDomain : undefined;

          // Create auth user via backend
          const registerResponse = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: signupData.email,
              password: signupData.password,
              firstName: signupData.firstName,
              lastName: signupData.lastName,
              phone: signupData.phone,
              whitelabel: signupData.whitelabel,
              slug: signupData.slug,
              planKey: data.plan, // Pass the selected plan
              industry: data.industry || null,
              tenant: requestedTenant
            })
          });

          const registerResult = await registerResponse.json();

          if (!registerResult.success) {
            throw new Error(registerResult.message || 'Registration failed');
          }

          // If whitelabel, complete signup
          if (signupData.whitelabel && signupData.slug && registerResult.data?.user?.id) {
            await fetch(`${API_BASE_URL}/api/v1/users/complete-signup`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: registerResult.data.user.id,
                slug: signupData.slug,
                whitelabel: true
              })
            });
          }

          // Now redirect to Stripe
          window.location.href = checkoutSession.url;
          return;

        } catch (error: any) {
          console.error('Payment/Registration error:', error);
          toast({
            title: "Error",
            description: error.message || "Failed to initiate payment. Please try again.",
            variant: "destructive"
          });
          return;
        }
      }

      // Existing Free Plan Logic (No Change needed mostly, just wrapped in else or proceed)

      const tenantFromDomain = extractTenantFromHostname();
      const requestedTenant = tenantFromDomain !== 'main' ? tenantFromDomain : undefined;

      // Create auth user via backend
      const registerResponse = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signupData.email,
          password: signupData.password,
          firstName: signupData.firstName,
          lastName: signupData.lastName,
          phone: signupData.phone,
          whitelabel: signupData.whitelabel,
          slug: signupData.slug,
          planKey: data.plan, // Pass the selected plan
          industry: data.industry || null,
          tenant: requestedTenant
        })
      });

      const registerResult = await registerResponse.json();

      if (!registerResult.success) {
        throw new Error(registerResult.message || 'Registration failed');
      }

      // If whitelabel, complete signup
      if (signupData.whitelabel && signupData.slug && registerResult.data?.user?.id) {
        await fetch(`${API_BASE_URL}/api/v1/users/complete-signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: registerResult.data.user.id,
            slug: signupData.slug,
            whitelabel: true
          })
        });
      }

      // Clear signup data
      localStorage.removeItem('signup-data');
      complete();

      // Redirect to login
      navigate('/auth?registered=true');
    } catch (error: any) {
      console.error('Onboarding completion error:', error);
      alert(error.message || 'Failed to complete onboarding');
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={data.companyName || ''}
                onChange={(e) => updateData({ companyName: e.target.value })}
                placeholder="Enter your company name"
              />
            </div>
            <div>
              <Label htmlFor="industry">Industry</Label>
              <Select
                value={data.industry || ''}
                onValueChange={(value) => updateData({ industry: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="real-estate">Real Estate</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="teamSize">Team Size</Label>
              <Select
                value={data.teamSize || ''}
                onValueChange={(value) => updateData({ teamSize: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select team size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-10">1-10</SelectItem>
                  <SelectItem value="11-50">11-50</SelectItem>
                  <SelectItem value="51-200">51-200</SelectItem>
                  <SelectItem value="201+">201+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="useCase">Primary Use Case</Label>
              <Select
                value={data.useCase || ''}
                onValueChange={(value) => updateData({ useCase: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select use case" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer-support">Customer Support</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="appointments">Appointment Scheduling</SelectItem>
                  <SelectItem value="lead-qualification">Lead Qualification</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <Label>Select a Plan</Label>
              {plansLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="text-muted-foreground">Loading plans...</span>
                </div>
              ) : plans.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No plans available. Please contact support.</p>
                </div>
              ) : (
                <>
                  {isWhitelabelDomain() && availableMinutes && availableMinutes.available !== null && (
                    <div className="mb-4 p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Available minutes: <span className="font-semibold">{availableMinutes.available.toLocaleString()}</span> / {availableMinutes.totalLimit?.toLocaleString()}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    {plans.map((plan) => {
                      const planMinutes = plan.minutes_limit || 0;
                      const isUnavailable = isWhitelabelDomain() &&
                        availableMinutes &&
                        availableMinutes.available !== null &&
                        (planMinutes === 0 || planMinutes > availableMinutes.available);

                      return (
                        <Card
                          key={plan.plan_key || plan.id}
                          className={`cursor-pointer transition-all hover:shadow-md ${data.plan === plan.plan_key ? 'border-primary border-2' : ''
                            } ${isUnavailable ? 'opacity-60 cursor-not-allowed' : ''}`}
                          onClick={() => !isUnavailable && handlePlanSelect(plan.plan_key)}
                        >
                          <CardHeader>
                            <CardTitle>{plan.name}</CardTitle>
                            <CardDescription className="text-xs uppercase">
                              {plan.plan_key}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div className="text-2xl font-bold">
                                ${plan.price}
                                <span className="text-sm font-normal">/month</span>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {plan.minutes_limit === 0
                                  ? 'Unlimited minutes'
                                  : `${plan.minutes_limit.toLocaleString()} minutes/month`
                                }
                              </div>
                              {Array.isArray(plan.features) && plan.features.length > 0 && (
                                <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                                  {plan.features.slice(0, 3).map((feature, idx) => (
                                    <li key={idx} className="flex items-start gap-1">
                                      <CheckCircle className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                                      <span>{feature}</span>
                                    </li>
                                  ))}
                                  {plan.features.length > 3 && (
                                    <li className="text-muted-foreground/70">
                                      +{plan.features.length - 3} more features
                                    </li>
                                  )}
                                </ul>
                              )}
                              {isUnavailable && (
                                <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  <span>Please contact your administrator</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h3 className="text-2xl font-bold">You're all set!</h3>
            <p className="text-muted-foreground">
              Click complete to finish setting up your account.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  const progress = ((currentStep + 1) / STEPS.length) * 100;
  const canProceed = currentStep === 0
    ? data.companyName && data.industry && data.teamSize
    : currentStep === 1
      ? data.useCase
      : currentStep === 2
        ? data.plan
        : true;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>{STEPS[currentStep].title}</CardTitle>
          <CardDescription>
            Step {currentStep + 1} of {STEPS.length}
          </CardDescription>
          <Progress value={progress} className="mt-4" />
        </CardHeader>
        <CardContent className="space-y-6">
          {renderStep()}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            {currentStep === STEPS.length - 1 ? (
              <Button onClick={handleComplete}>
                Complete
                <CheckCircle className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleNext} disabled={!canProceed}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

