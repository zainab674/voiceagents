import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface OnboardingData {
  companyName?: string;
  industry?: string;
  teamSize?: string;
  useCase?: string;
  plan?: string;
  role?: string;
  theme?: string;
  notifications?: boolean;
  goals?: string[];
}

interface OnboardingContextType {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  complete: () => void;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};

interface OnboardingProviderProps {
  children: ReactNode;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({ children }) => {
  const [data, setData] = useState<OnboardingData>(() => {
    // Load from localStorage if exists
    const saved = localStorage.getItem('onboarding-state');
    return saved ? JSON.parse(saved) : {};
  });

  const updateData = (updates: Partial<OnboardingData>) => {
    const newData = { ...data, ...updates };
    setData(newData);
    localStorage.setItem('onboarding-state', JSON.stringify(newData));
  };

  const complete = () => {
    localStorage.setItem('onboarding-completed', 'true');
    localStorage.removeItem('onboarding-state');
  };

  const reset = () => {
    setData({});
    localStorage.removeItem('onboarding-state');
    localStorage.removeItem('onboarding-completed');
  };

  return (
    <OnboardingContext.Provider value={{ data, updateData, complete, reset }}>
      {children}
    </OnboardingContext.Provider>
  );
};


