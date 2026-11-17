import { boolean, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";
const app = pgSchema("app");
export const accountOperations = app.table("account_provision_operation", {
  id: uuid("id").primaryKey(),
  targetId: uuid("target_id").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("running"),
  phase: text("phase").notNull().default("prepared"),
  requestKey: uuid("request_key").notNull().unique(),
  operatorReference: text("operator_reference").notNull(),
  inputReference: text("input_reference"),
  actorSessionId: uuid("actor_session_id"),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const userAccounts = app.table("user_account", {
  authUserId: uuid("auth_user_id").primaryKey(),
  status: text("status").notNull().default("pending_password"),
  operationId: uuid("operation_id").references(() => accountOperations.id),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  tempExpiresAt: timestamp("temp_expires_at", { withTimezone: true }),
  sessionsValidAfter: timestamp("sessions_valid_after", { withTimezone: true }).notNull().defaultNow(),
});
export const userProfiles = app.table("user_profile", {
  userId: uuid("user_id").primaryKey().references(() => userAccounts.authUserId),
  displayName: text("display_name").notNull().default(""),
  hasWorkshop: boolean("has_workshop").notNull().default(false),
});
