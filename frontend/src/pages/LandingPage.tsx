import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Phone, 
  Zap, 
  BarChart3, 
  Users, 
  MessageSquare,
  Shield,
  CheckCircle,
  ArrowRight,
  Play,
  Star
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import heroImage from "@/assets/ai-call-hero.jpg";

const LandingPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/auth');
    }
  };

  const handleSignIn = () => {
    navigate('/auth');
  };

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render landing page if user is authenticated
  if (user) {
    return null;
  }

  const features = [
    {
      icon: Phone,
      title: "AI-Powered Calling",
      description: "Advanced GPT-4o compatible voice AI for natural conversations and automated calling campaigns."
    },
    {
      icon: MessageSquare,
      title: "Omni-Channel Communication",
      description: "Seamlessly manage SMS, WhatsApp, Email, and voice calls through Twilio integration."
    },
    {
      icon: Users,
      title: "CRM Integration", 
      description: "Connect with HubSpot, Zoho, Ceipal, and other major CRM platforms for unified data management."
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description: "Comprehensive dashboards with AI-driven insights, call logs, and performance metrics."
    },
    {
      icon: Shield,
      title: "White-Label Solution",
      description: "Fully customizable platform with your branding, domain, and administrative controls."
    },
    {
      icon: Zap,
      title: "Easy Onboarding",
      description: "Quick setup with guided training modules and comprehensive support documentation."
    }
  ];

  const stats = [
    { number: "10,000+", label: "AI Calls Processed Daily" },
    { number: "98.5%", label: "Uptime Reliability" },
    { number: "45%", label: "Average Conversion Increase" },
    { number: "24/7", label: "Customer Support" }
  ];

  const testimonials = [
    {
      name: "Sarah Johnson",
      company: "TechCorp Solutions",
      role: "VP of Sales",
      content: "VoiceAI Pro transformed our lead qualification process. We've seen a 45% increase in qualified leads.",
      rating: 5
    },
    {
      name: "Michael Chen",
      company: "Growth Dynamics",
      role: "CEO",
      content: "The white-label solution allowed us to offer AI calling to our clients seamlessly. Game changer!",
      rating: 5
    },
    {
      name: "Emily Rodriguez",
      company: "Scale Ventures",
      role: "Operations Manager",
      content: "Integration with our existing CRM was flawless. The analytics dashboard provides incredible insights.",
      rating: 5
    }
  ];

  const pricingPlans = [
    {
      name: "Starter",
      price: "$299",
      period: "/month",
      description: "Perfect for small businesses",
      features: [
        "1,000 AI calls/month",
        "Basic CRM integration",
        "Email & SMS support",
        "Standard analytics",
        "Community support"
      ],
      popular: false
    },
    {
      name: "Professional",
      price: "$699",
      period: "/month", 
      description: "Ideal for growing companies",
      features: [
        "5,000 AI calls/month",
        "Advanced CRM integration",
        "All communication channels",
        "Advanced analytics & insights",
        "Priority support",
        "Custom AI training"
      ],
      popular: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For large organizations",
      features: [
        "Unlimited AI calls",
        "Full white-label solution",
        "Custom integrations",
        "Dedicated success manager",
        "SLA guarantees",
        "On-premise deployment"
      ],
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-r from-primary to-accent rounded-lg flex items-center justify-center">
                <Phone className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg">VoiceAI Pro</span>
            </div>
            
            <div className="flex items-center gap-4">
              {!loading && (
                <>
                  {user ? (
                    <Button onClick={handleGetStarted} className="bg-gradient-to-r from-primary to-accent">
                      Go to Dashboard
                    </Button>
                  ) : (
                    <>
                      <Button variant="ghost" onClick={handleSignIn}>
                        Sign In
                      </Button>
                      <Button onClick={handleGetStarted} className="bg-gradient-to-r from-primary to-accent">
                        Get Started
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div 
        className="relative h-screen bg-cover bg-center flex items-center justify-center pt-16"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-accent/80 backdrop-blur-sm" />
        <div className="relative text-center text-white z-10 max-w-4xl mx-auto px-4">
          <Badge variant="secondary" className="mb-4 bg-white/20 text-white border-white/30">
            🚀 Next-Generation AI Voice Platform
          </Badge>
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-white to-primary-glow bg-clip-text text-transparent">
            Scale Your Business with AI Voice Technology
          </h1>
          <p className="text-xl opacity-90 max-w-2xl mx-auto mb-8">
            Automate customer interactions, boost conversions, and integrate seamlessly with your existing CRM. 
            The complete white-label AI calling solution for modern businesses.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold px-8" onClick={handleGetStarted}>
              {user ? 'Go to Dashboard' : 'Start Free Trial'}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button variant="outline" size="lg" className="border-white text-white hover:bg-white/10 px-8">
              <Play className="w-5 h-5 mr-2" />
              Watch Demo
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {stat.number}
                </p>
                <p className="text-muted-foreground mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">
            Powerful Features for Modern Businesses
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to automate, scale, and optimize your customer communication workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="shadow-lg hover:shadow-xl transition-shadow border-0 bg-gradient-to-br from-background to-muted/50">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-r from-primary to-accent rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Testimonials Section */}
      <div className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Trusted by Industry Leaders
            </h2>
            <p className="text-xl text-muted-foreground">
              See what our customers are saying about VoiceAI Pro
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="shadow-lg">
                <CardContent className="p-6">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-current text-yellow-500" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-4">"{testimonial.content}"</p>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    <p className="text-sm text-primary">{testimonial.company}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="py-20 container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-muted-foreground">
            Choose the plan that scales with your business needs
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {pricingPlans.map((plan, index) => (
            <Card key={index} className={`shadow-lg relative ${
              plan.popular ? 'border-primary shadow-xl scale-105' : ''
            }`}>
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-primary to-accent">
                  Most Popular
                </Badge>
              )}
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <p className="text-muted-foreground">{plan.description}</p>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  className={`w-full ${
                    plan.popular ? 'bg-gradient-to-r from-primary to-accent' : ''
                  }`}
                  onClick={handleGetStarted}
                >
                  {plan.price === "Custom" ? "Contact Sales" : "Get Started"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 bg-gradient-to-r from-primary to-accent">
        <div className="container mx-auto px-4 text-center text-white">
          <h2 className="text-4xl font-bold mb-4">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
            Join thousands of businesses already using VoiceAI Pro to automate their customer interactions and boost conversions.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold px-8" onClick={handleGetStarted}>
              {user ? 'Go to Dashboard' : 'Start Your Free Trial'}
            </Button>
            <Button variant="outline" size="lg" className="border-white text-white hover:bg-white/10 px-8">
              Schedule Demo
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 bg-background border-t">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-primary to-accent rounded-lg flex items-center justify-center">
                  <Phone className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-lg">VoiceAI Pro</span>
              </div>
              <p className="text-muted-foreground">
                The complete AI voice platform for modern businesses.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>Features</li>
                <li>Pricing</li>
                <li>Integrations</li>
                <li>API Documentation</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>About Us</li>
                <li>Careers</li>
                <li>Contact</li>
                <li>Privacy Policy</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>Help Center</li>
                <li>Documentation</li>
                <li>Community</li>
                <li>Status Page</li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-muted-foreground">
            <p>&copy; 2024 VoiceAI Pro. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;