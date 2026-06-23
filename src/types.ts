export interface ComponentScores {
  driftSeverity: number;
  persistence: number;
  velocity: number;
  moneyImpact: number;
  concentration: number;
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
