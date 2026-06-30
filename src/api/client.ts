import {
  AuthUser,
  ComponentWeights,
  PortfolioProfile,
  WeightsUpdateResponse,
} from '../types';

const TOKEN_KEY = 'portfolio_drift_token';

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    let detail = 'Request failed';
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(detail, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function fetchMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/api/auth/me');
}

export async function fetchProfiles(): Promise<PortfolioProfile[]> {
  return apiFetch<PortfolioProfile[]>('/api/profiles');
}

export async function fetchWeights(): Promise<ComponentWeights> {
  return apiFetch<ComponentWeights>('/api/weights');
}

export async function updateWeights(weights: ComponentWeights): Promise<WeightsUpdateResponse> {
  return apiFetch<WeightsUpdateResponse>('/api/weights', {
    method: 'PUT',
    body: JSON.stringify(weights),
  });
}

export function mapProfile(item: PortfolioProfile): PortfolioProfile {
  return {
    ...item,
    clientName: item.clientName || 'Unknown',
    portfolioType: item.portfolioType || 'Unknown',
    identifier: item.identifier || 'Unknown',
    portfolioDriftPercent: item.portfolioDriftPercent ?? 0,
    riskProfile: item.riskProfile || 'Unknown',
    financialGoal: item.financialGoal || '',
    triggerCondition: item.triggerCondition || '',
    watchThreshold: item.watchThreshold ?? 0,
    criticalThreshold: item.criticalThreshold ?? 0,
    componentScores: item.componentScores ?? {
      driftSeverity: 0,
      persistence: 0,
      velocity: 0,
      moneyImpact: 0,
      concentration: 0,
    },
    classification: item.classification || 'Normal',
    priorityScore: item.priorityScore ?? 0,
  };
}

export function computePriorityScore(
  componentScores: PortfolioProfile['componentScores'],
  weights: ComponentWeights,
): number {
  const total =
    componentScores.driftSeverity * weights.driftSeverity +
    componentScores.persistence * weights.persistence +
    componentScores.velocity * weights.velocity +
    componentScores.moneyImpact * weights.moneyImpact +
    componentScores.concentration * weights.concentration;
  return Math.round(total * 1000) / 10;
}

export function classifyFromScore(priorityScore: number): string {
  if (priorityScore < 40) return 'Normal';
  if (priorityScore < 60) return 'Watch';
  if (priorityScore < 80) return 'Review Soon';
  return 'Critical';
}

export function applyWeightsToProfiles(
  profiles: PortfolioProfile[],
  weights: ComponentWeights,
): PortfolioProfile[] {
  return profiles.map((profile) => {
    const priorityScore = computePriorityScore(profile.componentScores, weights);
    return {
      ...profile,
      priorityScore,
      classification: classifyFromScore(priorityScore),
    };
  });
}

export function classificationCounts(profiles: PortfolioProfile[]): Record<string, number> {
  const counts: Record<string, number> = {
    Normal: 0,
    Watch: 0,
    'Review Soon': 0,
    Critical: 0,
  };
  for (const profile of profiles) {
    counts[profile.classification] = (counts[profile.classification] || 0) + 1;
  }
  return counts;
}

export { ApiError };
