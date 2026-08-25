import {
  DOMAIN_ERROR_CODES,
  DomainError,
  domainError,
} from './domain-error.js';
import {
  PullRequestNumber,
  createPullRequestNumber,
} from './pull-request-number.js';
import { Result, err, ok } from './result.js';

export type NewPullRequestStackMembers = readonly [
  PullRequestNumber,
  PullRequestNumber,
  ...PullRequestNumber[],
] & { readonly __brand: 'NewPullRequestStackMembers' };

export type PullRequestStackAdditions = readonly [
  PullRequestNumber,
  ...PullRequestNumber[],
] & { readonly __brand: 'PullRequestStackAdditions' };

const createOrderedUniquePullRequestNumbers = (
  values: readonly number[],
  minimum: number,
): Result<readonly PullRequestNumber[], DomainError> => {
  if (values.length < minimum || values.length > 100) {
    return err(
      domainError(
        DOMAIN_ERROR_CODES.InvalidPullRequestStackMembers,
        `A pull request stack operation requires between ${minimum} and 100 members`,
      ),
    );
  }

  const numbers: PullRequestNumber[] = [];
  for (const value of values) {
    const number = createPullRequestNumber(value);
    if (!number.ok) return number;
    numbers.push(number.value);
  }

  if (new Set(numbers).size !== numbers.length) {
    return err(
      domainError(
        DOMAIN_ERROR_CODES.InvalidPullRequestStackMembers,
        'Pull request stack members must be unique',
      ),
    );
  }

  return ok(numbers);
};

/** Validates members for a new stack, ordered from bottom to top. */
export const createNewPullRequestStackMembers = (
  values: readonly number[],
): Result<NewPullRequestStackMembers, DomainError> => {
  const numbers = createOrderedUniquePullRequestNumbers(values, 2);
  return numbers.ok ? ok(numbers.value as NewPullRequestStackMembers) : numbers;
};

/** Validates members appended above the current top of a stack. */
export const createPullRequestStackAdditions = (
  values: readonly number[],
): Result<PullRequestStackAdditions, DomainError> => {
  const numbers = createOrderedUniquePullRequestNumbers(values, 1);
  return numbers.ok ? ok(numbers.value as PullRequestStackAdditions) : numbers;
};
