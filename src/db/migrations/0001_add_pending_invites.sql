ALTER TABLE "action_items" ADD COLUMN "notification_sent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reminders" ADD COLUMN "notification_sent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "notification_sent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "shared_gardens" ADD COLUMN "pending_invites" jsonb DEFAULT '[]'::jsonb NOT NULL;