import { z } from 'zod';

export interface AppConfig {
  readonly host: string;
  readonly port: number;
  /** When true, error responses include messages/details for 5xx (non-prod). */
  readonly exposeInternalErrors: boolean;
  /** The GitHub token, supplied by the operator however they prefer. */
  readonly githubToken: string;
  readonly github: {
    readonly userAgent?: string;
    readonly baseUrl?: string;
  };
}

const envSchema = z.object({
  MARLOW_HOST: z.string().min(1).default('127.0.0.1'),
  MARLOW_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.string().optional(),
  // The only credential Marlow needs. Provide it however you like — pass-cli,
  // 1Password, Vault, a CI secret, or a plain export.
  MARLOW_GITHUB_TOKEN: z.string().min(1),
  MARLOW_GITHUB_USER_AGENT: z.string().min(1).optional(),
  MARLOW_GITHUB_BASE_URL: z.string().min(1).optional(),
});

/**
 * Loads and validates configuration from the environment. This is the only
 * place process.env is read; the rest of the system receives a typed AppConfig.
 */
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): AppConfig => {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid Marlow configuration: ${issues}`);
  }

  const values = parsed.data;
  return {
    host: values.MARLOW_HOST,
    port: values.MARLOW_PORT,
    exposeInternalErrors: values.NODE_ENV !== 'production',
    githubToken: values.MARLOW_GITHUB_TOKEN,
    github: {
      ...(values.MARLOW_GITHUB_USER_AGENT === undefined
        ? {}
        : { userAgent: values.MARLOW_GITHUB_USER_AGENT }),
      ...(values.MARLOW_GITHUB_BASE_URL === undefined
        ? {}
        : { baseUrl: values.MARLOW_GITHUB_BASE_URL }),
    },
  };
};
