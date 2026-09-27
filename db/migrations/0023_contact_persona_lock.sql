ALTER TABLE `characters` ADD `persona_locked` integer DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE `characters` SET `persona_locked` = true WHERE `type` = 'character';
