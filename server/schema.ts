import { boolean, date, numeric, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'cancelled', 'ignored']);
export const alertTypeEnum = pgEnum('alert_type', ['price_increase', 'renewal', 'duplicate', 'unused']);
export const authProviderEnum = pgEnum('auth_provider', ['email', 'google', 'both']);

export const usersTable = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash'),
  authProvider: authProviderEnum('auth_provider').notNull().default('email'),
  googleId: varchar('google_id', { length: 255 }).unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const transactionsTable = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  merchant: varchar('merchant', { length: 255 }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('EUR'),
  date: date('date').notNull(),
  rawDescription: text('raw_description').notNull(),
  importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
});

export const detectedSubscriptionsTable = pgTable('detected_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  merchant: varchar('merchant', { length: 255 }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  frequency: varchar('frequency', { length: 32 }).notNull(),
  category: varchar('category', { length: 80 }),
  firstSeen: date('first_seen').notNull(),
  lastSeen: date('last_seen').notNull(),
  status: subscriptionStatusEnum('status').notNull().default('active'),
});

export const alertsTable = pgTable('alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  subscriptionId: uuid('subscription_id').references(() => detectedSubscriptionsTable.id, { onDelete: 'set null' }),
  type: alertTypeEnum('type').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  read: boolean('read').notNull().default(false),
});
