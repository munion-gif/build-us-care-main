import type { JobStatus, OperationalOrderStatus, OrderStatus } from "@/lib/types";

export const ORDER_TRANSITIONS: Record<OrderStatus, OperationalOrderStatus[]> = {
  inquiry: ["quoted", "canceled"],
  quoted: ["payment_pending", "canceled"],
  payment_pending: ["paid", "canceled"],
  paid: ["scheduled", "cancel_requested", "canceled"],
  scheduled: ["in_progress", "cancel_requested", "canceled"],
  in_progress: ["completed", "issue", "cancel_requested"],
  completed: ["done", "issue"],
  done: ["warranty"],
  issue: ["scheduled", "in_progress", "completed", "done", "canceled"],
  warranty: ["scheduled", "in_progress", "done"],
  cancel_requested: ["canceled", "scheduled", "paid"],
  canceled: [],
  submitted: ["quoted", "canceled"],
  draft: ["inquiry", "canceled"],
  reservation_pending: ["payment_pending", "paid", "canceled"],
  reservation_confirmed: ["scheduled", "canceled"],
  preparing: ["scheduled", "in_progress", "canceled"],
  in_service: ["in_progress", "completed", "issue", "cancel_requested"],
  cancelled: []
};

export const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  received: ["material_ready", "assigned", "cancelled"],
  material_ready: ["assigned", "cancelled"],
  assigned: ["scheduled", "cancelled"],
  scheduled: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: []
};

export function canTransitionOrder(from: OrderStatus, to: OperationalOrderStatus) {
  return from === to || (ORDER_TRANSITIONS[from] ?? []).includes(to);
}

export function canTransitionJob(from: JobStatus, to: JobStatus) {
  return from === to || JOB_TRANSITIONS[from].includes(to);
}
