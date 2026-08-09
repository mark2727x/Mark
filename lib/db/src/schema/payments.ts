import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { shiftsTable } from "./shifts";

export const paymentTransactionsTable = pgTable("payment_transactions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  shiftId: integer("shift_id").notNull().references(() => shiftsTable.id),
  payerId: integer("payer_id").notNull().references(() => usersTable.id),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("usd"),
  status: text("status", { enum: ["initiated", "completed", "failed", "expired", "refunded"] }).notNull().default("initiated"),
  paymentStatus: text("payment_status", { enum: ["pending", "paid", "failed", "expired", "refunded"] }).notNull().default("pending"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type PaymentTransaction = typeof paymentTransactionsTable.$inferSelect;
