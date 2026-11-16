export class AccessError extends Error {
  constructor(public readonly code: "UNAUTHORIZED" | "ACCOUNT_BLOCKED" | "FORBIDDEN") { super(code); }
}
