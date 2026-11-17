import { boolean,integer,jsonb,text,timestamp,uuid,pgSchema } from 'drizzle-orm/pg-core';
const appSchema=pgSchema('app');
import type { NoteBody } from './content';
// SQL migrations additionally enforce same-owner FKs, RLS and deferred main-file constraints.
export const documents=appSchema.table('document',{
 id:uuid('id').primaryKey(),ownerId:uuid('owner_id').notNull(),title:text('title').notNull(),kind:text('kind').$type<'note'|'file'>().notNull(),body:jsonb('body_json').$type<NoteBody>(),rowVersion:integer('row_version').notNull().default(1),creationHash:text('creation_hash').notNull(),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),
});
export const assets=appSchema.table('asset',{
 id:uuid('id').primaryKey(),ownerId:uuid('owner_id').notNull(),workshopOnly:boolean('workshop_only').notNull().default(false),storageKey:text('storage_key').notNull(),originalName:text('original_name').notNull(),mime:text('mime').notNull(),bytes:integer('bytes').notNull(),state:text('state').$type<'pending'|'ready'|'deleting'>().notNull().default('pending'),checksum:text('checksum'),uploadExpiresAt:timestamp('upload_expires_at',{withTimezone:true}).notNull(),createdAt:timestamp('created_at',{withTimezone:true}).notNull().defaultNow(),updatedAt:timestamp('updated_at',{withTimezone:true}).notNull().defaultNow(),unlinkedAt:timestamp('unlinked_at',{withTimezone:true}).notNull().defaultNow(),
});
export const assetLinks=appSchema.table('asset_link',{id:uuid('id').primaryKey().defaultRandom(),ownerId:uuid('owner_id').notNull(),documentId:uuid('document_id'),procedureId:uuid('procedure_id'),productId:uuid('product_id'),journalEntryId:uuid('journal_entry_id'),snapshotId:uuid('snapshot_id'),purchaseId:uuid('purchase_id'),assetId:uuid('asset_id').notNull(),role:text('role').$type<'main'|'image'|'attachment'|'progress'|'finished'|'snapshot'|'invoice'>().notNull(),position:integer('position').notNull()});
