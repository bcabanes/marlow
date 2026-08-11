import { describe, expect, it } from 'vitest';
import {
  addLabelsBodySchema,
  assigneesBodySchema,
  createIssueBodySchema,
  createPullRequestReviewBodySchema,
  createPullRequestReviewCommentBodySchema,
  createPullRequestReviewCommentReplyBodySchema,
  listIssuesQuerySchema,
  paginationQuerySchema,
  repoParamsSchema,
  setMilestoneBodySchema,
  treeQuerySchema,
  updateIssueBodySchema,
} from '../index.js';

describe('repoParamsSchema', () => {
  it('requires non-empty owner and repo', () => {
    expect(
      repoParamsSchema.safeParse({ owner: 'nrwl', repo: 'nx' }).success,
    ).toBe(true);
    expect(repoParamsSchema.safeParse({ owner: '', repo: 'nx' }).success).toBe(
      false,
    );
  });
});

describe('paginationQuerySchema', () => {
  it('coerces query strings into bounded integers', () => {
    const parsed = paginationQuerySchema.parse({ page: '2', perPage: '50' });
    expect(parsed).toEqual({ page: 2, perPage: 50 });
    expect(paginationQuerySchema.safeParse({ perPage: '500' }).success).toBe(
      false,
    );
  });

  it('defaults perPage to 30 when omitted', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ perPage: 30 });
    expect(paginationQuerySchema.parse({ page: '2' })).toEqual({
      page: 2,
      perPage: 30,
    });
  });
});

describe('treeQuerySchema', () => {
  it('treats recursive as a true/false string, not generic truthiness', () => {
    expect(treeQuerySchema.parse({ ref: 'main', recursive: 'true' })).toEqual({
      ref: 'main',
      recursive: true,
    });
    expect(treeQuerySchema.parse({ ref: 'main', recursive: 'false' })).toEqual({
      ref: 'main',
      recursive: false,
    });
  });
});

describe('listIssuesQuerySchema', () => {
  it('restricts state to the known enum', () => {
    expect(listIssuesQuerySchema.safeParse({ state: 'open' }).success).toBe(
      true,
    );
    expect(listIssuesQuerySchema.safeParse({ state: 'weird' }).success).toBe(
      false,
    );
  });
});

describe('write bodies', () => {
  it('require confirm: true', () => {
    expect(createIssueBodySchema.safeParse({ title: 'hi' }).success).toBe(
      false,
    );
    expect(
      createIssueBodySchema.safeParse({ confirm: true, title: 'hi' }).success,
    ).toBe(true);
    expect(
      createIssueBodySchema.safeParse({ confirm: false, title: 'hi' }).success,
    ).toBe(false);
  });
});

describe('updateIssueBodySchema', () => {
  it('requires confirm and at least one editable field', () => {
    expect(updateIssueBodySchema.safeParse({ confirm: true }).success).toBe(
      false,
    );
    expect(
      updateIssueBodySchema.safeParse({ confirm: true, title: 'New' }).success,
    ).toBe(true);
    expect(
      updateIssueBodySchema.safeParse({ confirm: true, state: 'open' }).success,
    ).toBe(true);
    expect(updateIssueBodySchema.safeParse({ title: 'New' }).success).toBe(
      false,
    );
  });

  it('restricts state and stateReason to the known enums', () => {
    expect(
      updateIssueBodySchema.safeParse({ confirm: true, state: 'merged' })
        .success,
    ).toBe(false);
    expect(
      updateIssueBodySchema.safeParse({ confirm: true, stateReason: 'done' })
        .success,
    ).toBe(false);
  });
});

describe('metadata bodies', () => {
  it('addLabels requires confirm and a non-empty label list', () => {
    expect(
      addLabelsBodySchema.safeParse({ confirm: true, labels: ['bug'] }).success,
    ).toBe(true);
    expect(
      addLabelsBodySchema.safeParse({ confirm: true, labels: [] }).success,
    ).toBe(false);
    expect(addLabelsBodySchema.safeParse({ labels: ['bug'] }).success).toBe(
      false,
    );
  });

  it('assignees requires confirm and a non-empty assignee list', () => {
    expect(
      assigneesBodySchema.safeParse({ confirm: true, assignees: ['octocat'] })
        .success,
    ).toBe(true);
    expect(
      assigneesBodySchema.safeParse({ confirm: true, assignees: [] }).success,
    ).toBe(false);
  });

  it('setMilestone requires confirm and a positive integer', () => {
    expect(
      setMilestoneBodySchema.safeParse({ confirm: true, milestone: 3 }).success,
    ).toBe(true);
    expect(
      setMilestoneBodySchema.safeParse({ confirm: true, milestone: 0 }).success,
    ).toBe(false);
    expect(
      setMilestoneBodySchema.safeParse({ confirm: true, milestone: 1.5 })
        .success,
    ).toBe(false);
  });
});

describe('pull-request review comment bodies', () => {
  const common = {
    confirm: true,
    body: 'Please rename this',
    commitId: 'a'.repeat(40),
    path: 'src/index.ts',
  } as const;

  it('accepts line, range, and file targets', () => {
    expect(
      createPullRequestReviewCommentBodySchema.safeParse({
        ...common,
        line: 12,
        side: 'RIGHT',
      }).success,
    ).toBe(true);
    expect(
      createPullRequestReviewCommentBodySchema.safeParse({
        ...common,
        subjectType: 'line',
        line: 12,
        side: 'RIGHT',
        startLine: 10,
        startSide: 'RIGHT',
      }).success,
    ).toBe(true);
    expect(
      createPullRequestReviewCommentBodySchema.safeParse({
        ...common,
        subjectType: 'file',
      }).success,
    ).toBe(true);
  });

  it('rejects unpaired ranges, line fields on files, position, and snake_case', () => {
    for (const payload of [
      { ...common, line: 12, side: 'RIGHT', startLine: 10 },
      { ...common, subjectType: 'file', line: 12, side: 'RIGHT' },
      { ...common, line: 12, side: 'RIGHT', position: 4 },
      { ...common, line: 12, side: 'RIGHT', start_line: 10 },
    ]) {
      expect(
        createPullRequestReviewCommentBodySchema.safeParse(payload).success,
      ).toBe(false);
    }
  });

  it('requires non-empty bounded comment and reply bodies', () => {
    expect(
      createPullRequestReviewCommentBodySchema.safeParse({
        ...common,
        body: '',
        line: 12,
        side: 'RIGHT',
      }).success,
    ).toBe(false);
    expect(
      createPullRequestReviewCommentReplyBodySchema.safeParse({
        confirm: true,
        body: 'x'.repeat(65536),
      }).success,
    ).toBe(true);
    expect(
      createPullRequestReviewCommentReplyBodySchema.safeParse({
        confirm: true,
        body: 'x'.repeat(65537),
      }).success,
    ).toBe(false);
  });
});

describe('createPullRequestReviewBodySchema', () => {
  it('requires a body for COMMENT and REQUEST_CHANGES but not APPROVE', () => {
    expect(
      createPullRequestReviewBodySchema.safeParse({
        confirm: true,
        event: 'COMMENT',
      }).success,
    ).toBe(false);
    expect(
      createPullRequestReviewBodySchema.safeParse({
        confirm: true,
        event: 'REQUEST_CHANGES',
        body: 'Please update this',
      }).success,
    ).toBe(true);
    expect(
      createPullRequestReviewBodySchema.safeParse({
        confirm: true,
        event: 'APPROVE',
        body: '',
      }).success,
    ).toBe(true);
  });

  it('accepts optional commitId and an empty comments array', () => {
    const parsed = createPullRequestReviewBodySchema.parse({
      confirm: true,
      event: 'APPROVE',
      commitId: 'a'.repeat(40),
      comments: [],
    });
    expect(parsed.commitId).toBe('a'.repeat(40));
    expect(parsed.comments).toEqual([]);
  });

  it('strictly validates nested line/range comments', () => {
    expect(
      createPullRequestReviewBodySchema.safeParse({
        confirm: true,
        event: 'COMMENT',
        body: 'Summary',
        comments: [
          {
            body: 'Inline',
            path: 'src/index.ts',
            line: 12,
            side: 'RIGHT',
            startLine: 10,
            startSide: 'RIGHT',
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      createPullRequestReviewBodySchema.safeParse({
        confirm: true,
        event: 'COMMENT',
        body: 'Summary',
        comments: [
          {
            body: 'Inline',
            path: 'src/index.ts',
            line: 12,
            side: 'RIGHT',
            subjectType: 'file',
          },
        ],
      }).success,
    ).toBe(false);
  });
});
