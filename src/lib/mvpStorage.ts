import type { LeadScoreCriteria } from '../components/LeadScoreModal';

const STORAGE_KEYS = {
  LEAD_SCORES: 'mvp_lead_scores',
  PARTNERS: 'mvp_partners',
  CALL_LOGS: 'mvp_call_logs',
};

// ─── Lead Scores ───────────────────────────────────
export interface StoredLeadScore {
  leadId: string;
  leadName: string;
  criteria: LeadScoreCriteria;
  score: number;
  savedAt: string;
}

export const saveLeadScore = (leadId: string, leadName: string, criteria: LeadScoreCriteria, score: number) => {
  const scores = getAllLeadScores();
  const index = scores.findIndex(s => s.leadId === leadId);
  
  const newScore: StoredLeadScore = {
    leadId,
    leadName,
    criteria,
    score,
    savedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    scores[index] = newScore;
  } else {
    scores.push(newScore);
  }

  localStorage.setItem(STORAGE_KEYS.LEAD_SCORES, JSON.stringify(scores));
  return newScore;
};

export const getLeadScore = (leadId: string): StoredLeadScore | null => {
  const scores = getAllLeadScores();
  return scores.find(s => s.leadId === leadId) || null;
};

export const getAllLeadScores = (): StoredLeadScore[] => {
  const data = localStorage.getItem(STORAGE_KEYS.LEAD_SCORES);
  return data ? JSON.parse(data) : [];
};

export const deleteLeadScore = (leadId: string) => {
  const scores = getAllLeadScores();
  const filtered = scores.filter(s => s.leadId !== leadId);
  localStorage.setItem(STORAGE_KEYS.LEAD_SCORES, JSON.stringify(filtered));
};

// ─── Call & WhatsApp Logs ──────────────────────────
export interface CallLog {
  id: string;
  leadId: string;
  leadName: string;
  type: 'call' | 'whatsapp';
  phone: string;
  duration?: number;
  timestamp: string;
  notes?: string;
}

export const saveCallLog = (leadId: string, leadName: string, type: 'call' | 'whatsapp', phone: string, notes?: string): CallLog => {
  const logs = getAllCallLogs();
  const log: CallLog = {
    id: `call_${Date.now()}`,
    leadId,
    leadName,
    type,
    phone,
    timestamp: new Date().toISOString(),
    notes,
  };
  
  logs.push(log);
  localStorage.setItem(STORAGE_KEYS.CALL_LOGS, JSON.stringify(logs));
  return log;
};

export const getAllCallLogs = (): CallLog[] => {
  const data = localStorage.getItem(STORAGE_KEYS.CALL_LOGS);
  return data ? JSON.parse(data) : [];
};

export const getCallLogsByLead = (leadId: string): CallLog[] => {
  const logs = getAllCallLogs();
  return logs.filter(l => l.leadId === leadId).sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
};

// ─── Partners (CRM Parceiros) ──────────────────────
export interface StoredPartner {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'negociacao' | 'fechado';
  works: string[]; // IDs de obras/leads associados
  birthDate?: string;
  importantDates?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const savePartner = (partner: Omit<StoredPartner, 'id' | 'createdAt' | 'updatedAt'>, id?: string): StoredPartner => {
  const partners = getAllPartners();
  const now = new Date().toISOString();
  
  const newPartner: StoredPartner = {
    ...partner,
    id: id || `partner_${Date.now()}`,
    createdAt: id ? partners.find(p => p.id === id)?.createdAt || now : now,
    updatedAt: now,
  };

  const index = partners.findIndex(p => p.id === newPartner.id);
  if (index >= 0) {
    partners[index] = newPartner;
  } else {
    partners.push(newPartner);
  }

  localStorage.setItem(STORAGE_KEYS.PARTNERS, JSON.stringify(partners));
  return newPartner;
};

export const getAllPartners = (): StoredPartner[] => {
  const data = localStorage.getItem(STORAGE_KEYS.PARTNERS);
  return data ? JSON.parse(data) : [];
};

export const getPartner = (id: string): StoredPartner | null => {
  const partners = getAllPartners();
  return partners.find(p => p.id === id) || null;
};

export const deletePartner = (id: string) => {
  const partners = getAllPartners();
  const filtered = partners.filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEYS.PARTNERS, JSON.stringify(filtered));
};

export const addWorkToPartner = (partnerId: string, workId: string) => {
  const partner = getPartner(partnerId);
  if (!partner) return null;
  
  if (!partner.works.includes(workId)) {
    partner.works.push(workId);
  }
  
  return savePartner(partner, partnerId);
};

export const removeWorkFromPartner = (partnerId: string, workId: string) => {
  const partner = getPartner(partnerId);
  if (!partner) return null;
  
  partner.works = partner.works.filter(w => w !== workId);
  return savePartner(partner, partnerId);
};