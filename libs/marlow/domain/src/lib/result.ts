/**
 * A minimal, explicit operation result type for the Marlow domain.
 *
 * Domain constructors and application use cases return `Result` instead of
 * throwing so that validation and authorization failures are part of the type
 * signature and must be handled by callers.
 */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
