ALTER TABLE `movements` ADD `source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `movements` ADD `reference` text;--> statement-breakpoint
CREATE UNIQUE INDEX `movements_reference_unique` ON `movements` (`reference`);--> statement-breakpoint
ALTER TABLE `products` ADD `barcode` text;--> statement-breakpoint
CREATE UNIQUE INDEX `products_barcode_unique` ON `products` (`barcode`);
