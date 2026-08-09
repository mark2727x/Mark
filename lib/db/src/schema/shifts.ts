import { pgTable, serial, text, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const shiftsTable = pgTable("shifts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  location: text("location").notNull(),
  payRate: real("pay_rate").notNull(),
  totalHours: real("total_hours").notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  certificationRequired: text("certification_required").notNull(),
  description: text("description").notNull(),
  rules: text("rules").notNull(),
  status: text("status", { enum: ["open", "filled", "completed", "cancelled"] }).notNull().default("open"),
  paymentStatus: text("payment_status", { enum: ["unpaid", "paid", "refunded", "payout_pending", "paid_out"] }).notNull().default("unpaid"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeTransferId: text("stripe_transfer_id"),
  managerId: integer("manager_id").notNull().references(() => usersTable.id),
  workerId: integer("worker_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertShiftSchema = createInsertSchema(shiftsTable).omit({
  id: true, createdAt: true, updatedAt: true, status: true, workerId: true,
});
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type Shift = typeof shiftsTable.$inferSelect;
