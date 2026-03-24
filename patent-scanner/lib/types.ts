export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Patent {
  id: string;
  title: string;
  filingDate: string;
  assignee: string;
  status: string;
  patentNumber: string | null;
  googlePatentsUrl: string;
  similarityReason: string;
}

export interface Message {
  id: string;
  type: 'user' | 'analysis' | 'patent-link';
  content: string;
  patent?: Patent;
  imageEmoji?: string;
  imageName?: string;
  timestamp: number;
}

export interface ScanResult {
  riskLevel: RiskLevel;
  riskScore: number;
  summary: string;
  elementRisks: { element: string; risk: RiskLevel; reasoning: string }[];
  patents: Patent[];
  recommendations: string[];
  disclaimer: string;
  dataSource: 'live' | 'training';
}

export interface Chat {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
}

export interface SavedPatent extends Patent {
  savedAt: number;
  chatId: string;
  chatTitle: string;
}
