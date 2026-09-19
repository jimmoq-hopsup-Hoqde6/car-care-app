import type {
  NewService,
  NewVehicle,
  Reminder,
  Service,
  Vehicle,
} from "./types";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const message = await res.text().catch(() => res.statusText);
    throw new Error(message || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  listVehicles: () => request<Vehicle[]>("/vehicles"),
  createVehicle: (data: NewVehicle) =>
    request<Vehicle>("/vehicles", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteVehicle: (id: number) =>
    request<void>(`/vehicles/${id}`, { method: "DELETE" }),
  listServices: (vehicleId: number) =>
    request<Service[]>(`/vehicles/${vehicleId}/services`),
  createService: (vehicleId: number, data: NewService) =>
    request<Service>(`/vehicles/${vehicleId}/services`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteService: (id: number) =>
    request<void>(`/services/${id}`, { method: "DELETE" }),
  listReminders: (vehicleId: number) =>
    request<Reminder[]>(`/vehicles/${vehicleId}/reminders`),
};
