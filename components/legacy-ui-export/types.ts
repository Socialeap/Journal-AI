
export type LegacyStatus = string;

export interface LegacyItem {
  id: string;
  title: string;
  description: string;
  status: LegacyStatus;
  tags: string[];
  date: string;
  priority: 'high' | 'medium' | 'low' | 'none';
  meta: { label: string; value: string }[];
}

export interface LegacyStat {
  label: string;
  value: string | number;
  trend?: string;
  colorScheme?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
}
