import { z } from 'zod';

/** Query for listing a repository tree at a ref. */
export const treeQuerySchema = z.object({
  ref: z.string().min(1),
  // Query strings are textual, so a plain coercion would treat "false" as true.
  recursive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});
export type TreeQuery = z.infer<typeof treeQuerySchema>;

/** Query for fetching a single file's contents (optional ref). */
export const fileContentsQuerySchema = z.object({
  ref: z.string().min(1).optional(),
});
export type FileContentsQuery = z.infer<typeof fileContentsQuerySchema>;
