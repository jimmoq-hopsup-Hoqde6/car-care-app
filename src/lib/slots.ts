export type TimeSlot = {
  startIso: string;
  endIso: string;
  label: string;
  dayLabel: string;
  busy: boolean;
  recommended?: boolean;
  recommendReason?: string;
  recommendRank?: number;
};
