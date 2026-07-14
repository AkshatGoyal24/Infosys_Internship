export type UserRole = 'admin' | 'advisor';

export interface AuthUser {
  username: string;
  role: UserRole;
}

export interface ComponentWeights {
  driftSeverity: number;
  persistence: number;
  velocity: number;
  moneyImpact: number;
  concentration: number;
}

export interface ComponentScores {
  driftSeverity: number;
  persistence: number;
  velocity: number;
  moneyImpact: number;
  concentration: number;
}

export interface ClientAIReport {
  executiveSummary: string;
  situationAssessment?: string;
  keyConcerns: string[];
  riskDrivers?: string[];
  recommendedActions: string[];
  outlook?: string;
  urgencyLevel: 'low' | 'medium' | 'high';
}

export interface ClientReportResponse {
  profile: PortfolioProfile;
  weights: ComponentWeights;
  report: ClientAIReport;
  cached: boolean;
}

export interface PortfolioProfile {
  source?: string;
  clientName: string;
  portfolioType: string;
  dob?: string;
  identifier: string;
  portfolioValue?: number;
  initialInvestment?: number;
  equityPercent?: number;
  fixedIncomePercent?: number;
  cashPercent?: number;
  alternativesPercent?: number;
  portfolioDriftPercent: number;
  riskProfile: string;
  financialGoal?: string;
  equityDriftPercent?: number;
  fixedIncomeDriftPercent?: number;
  cashDriftPercent?: number;
  alternativesDriftPercent?: number;
  daysOutsideThreshold?: number;
  previousDriftPercent?: number;
  driftVelocityPercent?: number;
  triggerCondition?: string;
  concentrationPercent?: number;
  dollarDriftEstimate?: number;
  watchThreshold: number;
  criticalThreshold: number;
  riskLevel?: string;
  componentScores: ComponentScores;
  classification: string;
  priorityScore: number;
}

export interface WeightsUpdateResponse {
  weights: ComponentWeights;
  classificationCounts: Record<string, number>;
  previousClassificationCounts: Record<string, number>;
}

export type ComponentWeightKey = keyof ComponentWeights;

export const COMPONENT_LABELS: Record<ComponentWeightKey, string> = {
  driftSeverity: 'Drift Severity',
  persistence: 'Persistence',
  velocity: 'Velocity',
  moneyImpact: 'Money Impact',
  concentration: 'Concentration',
};

export const COMPONENT_KEYS: ComponentWeightKey[] = [
  'driftSeverity',
  'persistence',
  'velocity',
  'moneyImpact',
  'concentration',
];
