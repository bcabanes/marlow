import { z } from 'zod';

// Label and assignee metadata applies to both issues and pull requests: a pull
// request's number is its issue number for GitHub's labels/assignees endpoints,
// so these bodies are shared by the issue and pull routes.

const labelName = z.string().min(1).max(50);
const assigneeLogin = z.string().min(1).max(39);

/** Body for adding labels to an issue or PR. Write endpoint: requires `confirm: true`. */
export const addLabelsBodySchema = z.object({
  confirm: z.literal(true),
  labels: z.array(labelName).min(1).max(20),
});
export type AddLabelsBody = z.infer<typeof addLabelsBodySchema>;

/** Body for adding or removing assignees. Write endpoint: requires `confirm: true`. */
export const assigneesBodySchema = z.object({
  confirm: z.literal(true),
  assignees: z.array(assigneeLogin).min(1).max(10),
});
export type AssigneesBody = z.infer<typeof assigneesBodySchema>;

/** Body for setting a milestone. Write endpoint: requires `confirm: true`. */
export const setMilestoneBodySchema = z.object({
  confirm: z.literal(true),
  milestone: z.number().int().min(1),
});
export type SetMilestoneBody = z.infer<typeof setMilestoneBodySchema>;
