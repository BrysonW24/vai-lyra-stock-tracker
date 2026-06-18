import factsData from '@/lib/generated/finance-facts.json';

export type FactCategory = 'definition' | 'history' | 'mechanics' | 'concept' | 'au' | 'fun' | 'advice';

export interface FinanceFact {
  id: string;
  term: string;
  body: string;
  category: FactCategory;
  level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  educationId?: string;
}

/**
 * Finance facts library - the "Good to know" rotating-fact backlog. Agent/human-editable
 * one line at a time in content/finance-facts.jsonl, compiled to importable JSON. Built to
 * grow from this starter set toward 1000+ without touching code - just append lines.
 */
export const FINANCE_FACTS = factsData as FinanceFact[];
