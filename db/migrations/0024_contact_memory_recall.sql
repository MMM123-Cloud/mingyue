ALTER TABLE `chat_entries` ADD `recalled_at` integer;--> statement-breakpoint
ALTER TABLE `chat_entries` ADD `recalled_by` text;--> statement-breakpoint
CREATE TABLE `contact_memories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`character_id` integer NOT NULL,
	`source_entry_id` integer,
	`speaker` text NOT NULL,
	`content` text NOT NULL,
	`importance` integer DEFAULT 40 NOT NULL,
	`created_at` integer NOT NULL,
	`last_recalled_at` integer,
	`recall_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_entry_id`) REFERENCES `chat_entries`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `contact_memories_character_importance_idx` ON `contact_memories` (`character_id`,`importance`);
--> statement-breakpoint
CREATE UNIQUE INDEX `contact_memories_source_entry_unique` ON `contact_memories` (`source_entry_id`) WHERE `source_entry_id` IS NOT NULL;
