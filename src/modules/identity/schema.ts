import { boolean, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";
const app = pgSchema("app");
export const userAccounts = app.table("user_account", {
  authUserId: uuid("auth_user_id").primaryKey(),
  status: text("status").notNull().default("pending_password"),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  tempExpiresAt: timestamp("temp_expires_at", { withTimezone: true }),
  sessionsValidAfter: timestamp("sessions_valid_after", { withTimezone: true }).notNull().defaultNow(),
});
export const userProfiles = app.table("user_profile", {
  userId: uuid("user_id").primaryKey().references(() => userAccounts.authUserId),
  displayName: text("display_name").notNull().default(""),
  hasWorkshop: boolean("has_workshop").notNull().default(false),
});
