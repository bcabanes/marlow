import {
  DomainError,
  PullRequestNumber,
  Result,
  createPullRequestNumber,
  ok,
} from '@org/marlow-domain';

export const validatePullRequestNumbers = (
  values: readonly number[],
): Result<readonly PullRequestNumber[], DomainError> => {
  const numbers: PullRequestNumber[] = [];
  for (const value of values) {
    const number = createPullRequestNumber(value);
    if (!number.ok) return number;
    numbers.push(number.value);
  }
  return ok(numbers);
};
