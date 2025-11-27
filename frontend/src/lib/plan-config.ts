/**
 * Plan Configuration
 * Defines minutes allocation and features for each plan
 * Fetches from API with fallback to defaults
 */

// Plan configuration for voiceagents
export interface PlanConfig {
  plan_key: string;
  name: string;
  price: number;
  minutes_limit: number;
  features: string[];
  tenant?: string | null;
  is_active?: boolean;
  display_order?: number;
}

// Default fallback plans (used if API fetch fails)
export const DEFAULT_PLANS: Record<string, Omit<PlanConfig, 'tenant'>> = {
  starter: {
    plan_key: 'starter',
    name: 'Starter',
    price: 29,
    minutes_limit: 1000,
    features: [
      '1,000 minutes/month',
      'Basic AI agents',
      'Email support',
      'Call analytics'
    ],
    display_order: 1
  },
  professional: {
    plan_key: 'professional',
    name: 'Professional',
    price: 99,
    minutes_limit: 5000,
    features: [
      '5,000 minutes/month',
      'Advanced AI agents',
      'Priority support',
      'Advanced analytics',
      'CRM integration'
    ],
    display_order: 2
  },
  enterprise: {
    plan_key: 'enterprise',
    name: 'Enterprise',
    price: 299,
    minutes_limit: 20000,
    features: [
      '20,000 minutes/month',
      'Custom AI agents',
      '24/7 support',
      'Enterprise analytics',
      'Full CRM integration',
      'Custom integrations'
    ],
    display_order: 3
  },
  unlimited: {
    plan_key: 'unlimited',
    name: 'Unlimited',
    price: 999,
    minutes_limit: 0, // 0 means unlimited
    features: [
      'Unlimited minutes',
      'Custom AI agents',
      'Dedicated support',
      'Enterprise analytics',
      'Full CRM integration',
      'Custom integrations',
      'White label options'
    ],
    display_order: 4
  }
};

// Cache for plan configs
let planConfigsCache: Record<string, PlanConfig> | null = null;
let planConfigsCacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Convert API plan data to PlanConfig format
 */
function normalizePlan(plan: any): PlanConfig {
  return {
    plan_key: plan.plan_key,
    name: plan.name,
    price: typeof plan.price === 'number' ? plan.price : parseFloat(plan.price || '0'),
    minutes_limit: typeof plan.minutes_limit === 'number' ? plan.minutes_limit : parseInt(plan.minutes_limit || '0'),
    features: Array.isArray(plan.features) ? plan.features : [],
    tenant: plan.tenant || null,
    is_active: plan.is_active !== undefined ? plan.is_active : true,
    display_order: plan.display_order || 0
  };
}

/**
 * Get plan configs from API (filtered by tenant)
 * @param plans - Array of plans from API response
 * @returns Record of plan configs keyed by plan_key
 */
export function getPlanConfigsFromApi(plans: any[]): Record<string, PlanConfig> {
  if (!plans || plans.length === 0) {
    return DEFAULT_PLANS;
  }

  // Convert API format to PlanConfig format
  const configs: Record<string, PlanConfig> = {};
  for (const plan of plans) {
    const normalized = normalizePlan(plan);
    configs[normalized.plan_key] = normalized;
  }

  // Merge with defaults (API plans override defaults)
  return { ...DEFAULT_PLANS, ...configs };
}

/**
 * Get plan configs synchronously (uses cache or defaults)
 * Use this for synchronous operations
 */
export function getPlanConfigsSync(): Record<string, PlanConfig> {
  return planConfigsCache || DEFAULT_PLANS;
}

/**
 * Set plan configs cache (call after fetching from API)
 */
export function setPlanConfigsCache(configs: Record<string, PlanConfig>): void {
  planConfigsCache = configs;
  planConfigsCacheTime = Date.now();
}

/**
 * Invalidate plan configs cache (call after admin updates plans)
 */
export function invalidatePlanConfigsCache(): void {
  planConfigsCache = null;
  planConfigsCacheTime = 0;
}

/**
 * Get minutes limit for a plan
 * @param planKey - The plan key (starter, professional, enterprise, unlimited)
 * @returns Minutes limit (0 means unlimited)
 */
export function getMinutesLimitForPlan(planKey: string | null | undefined): number {
  if (!planKey) {
    return getPlanConfigsSync().starter?.minutes_limit || 0;
  }
  
  const plan = getPlanConfigsSync()[planKey.toLowerCase()];
  return plan?.minutes_limit ?? getPlanConfigsSync().starter?.minutes_limit || 0;
}

/**
 * Get plan configuration (synchronous - uses cache)
 * @param planKey - The plan key
 * @returns Plan configuration or starter plan as default
 */
export function getPlanConfig(planKey: string | null | undefined): PlanConfig {
  if (!planKey) {
    return getPlanConfigsSync().starter || DEFAULT_PLANS.starter;
  }
  
  const plan = getPlanConfigsSync()[planKey.toLowerCase()];
  return plan ?? getPlanConfigsSync().starter ?? DEFAULT_PLANS.starter;
}

/**
 * Get plan name
 * @param planKey - The plan key
 * @returns Plan name or planKey as fallback
 */
export function getPlanName(planKey: string | null | undefined): string {
  if (!planKey) {
    return getPlanConfigsSync().starter?.name || 'Starter';
  }
  
  const plan = getPlanConfigsSync()[planKey.toLowerCase()];
  return plan?.name ?? planKey;
}

/**
 * Check if plan has unlimited minutes
 * @param planKey - The plan key
 * @returns true if unlimited (minutesLimit === 0)
 */
export function isUnlimitedPlan(planKey: string | null | undefined): boolean {
  return getMinutesLimitForPlan(planKey) === 0;
}

/**
 * Format minutes for display
 * @param minutes - Minutes count (0 means unlimited)
 * @returns Formatted string
 */
export function formatMinutes(minutes: number): string {
  if (minutes === 0) {
    return "Unlimited";
  }
  if (minutes >= 1000) {
    return `${(minutes / 1000).toFixed(1)}k`;
  }
  return minutes.toString();
}

