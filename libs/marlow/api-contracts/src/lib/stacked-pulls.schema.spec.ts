import { describe, expect, it } from 'vitest';
import {
  addPullRequestsToStackBodySchema,
  createPullRequestStackBodySchema,
  mergePullRequestAsyncBodySchema,
  pullRequestMergeResultParamsSchema,
} from './pulls.schema.js';

describe('stacked pull-request contracts', () => {
  it('requires 2-100 unique pull request numbers when creating a stack', () => {
    expect(
      createPullRequestStackBodySchema.safeParse({
        confirm: true,
        pullNumbers: [101, 102],
      }).success,
    ).toBe(true);
    expect(
      createPullRequestStackBodySchema.safeParse({
        confirm: true,
        pullNumbers: [101],
      }).success,
    ).toBe(false);
    expect(
      createPullRequestStackBodySchema.safeParse({
        confirm: true,
        pullNumbers: [101, 101],
      }).success,
    ).toBe(false);
  });

  it('requires at least one unique pull request when extending a stack', () => {
    expect(
      addPullRequestsToStackBodySchema.safeParse({
        confirm: true,
        pullNumbers: [103],
      }).success,
    ).toBe(true);
    expect(
      addPullRequestsToStackBodySchema.safeParse({
        confirm: true,
        pullNumbers: [],
      }).success,
    ).toBe(false);
  });

  it('rejects commit options for an explicit merge-queue action', () => {
    expect(
      mergePullRequestAsyncBodySchema.safeParse({
        confirm: true,
        mergeAction: 'default',
        mergeMethod: 'squash',
      }).success,
    ).toBe(true);
    expect(
      mergePullRequestAsyncBodySchema.safeParse({
        confirm: true,
        mergeAction: 'merge_queue',
        mergeMethod: 'squash',
      }).success,
    ).toBe(false);
  });

  it('validates merge result UUIDs', () => {
    expect(
      pullRequestMergeResultParamsSchema.safeParse({
        owner: 'nrwl',
        repo: 'nx',
        pullNumber: '102',
        mergeId: '630b9d5e-3f2a-4f7e-8b0c-2d5f9a8c1e42',
      }).success,
    ).toBe(true);
    expect(
      pullRequestMergeResultParamsSchema.safeParse({
        owner: 'nrwl',
        repo: 'nx',
        pullNumber: '102',
        mergeId: 'bad',
      }).success,
    ).toBe(false);
  });
});
