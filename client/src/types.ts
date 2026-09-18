export interface Vehicle {
  id: number;
  nickname: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  created_at: string;
}

export interface Service {
  id: number;
  vehicle_id: number;
  type: string;
  performed_on: string;
  mileage: number;
  cost: number;
  notes: string;
  created_at: string;
}

export type ReminderStatus = "overdue" | "due-soon" | "ok";

export interface Reminder {
  type: string;
  status: ReminderStatus;
  dueAtMileage: number;
  milesRemaining: number;
  lastPerformedOn: string | null;
  lastMileage: number | null;
}

export interface NewVehicle {
  nickname: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
}

export interface NewService {
  type: string;
  performedOn: string;
  mileage: number;
  cost: number;
  notes: string;
}
