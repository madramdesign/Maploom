/** Errors that are safe to show to customers. Never carries stack traces or addresses. */
export const ERROR_MESSAGES = {
  ADDRESS_NOT_FOUND: "We couldn't find that place. Try adding a city or ZIP code.",
  GEOCODER_UNAVAILABLE: 'Address search is taking a break. Please try again in a moment.',
  GEODATA_UNAVAILABLE: "We couldn't reach our map data just now. Please try again in a moment.",
  NO_GEODATA: "There isn't enough map data for this spot yet. Try a slightly larger area or a nearby place.",
  AREA_TOO_LARGE: 'That area is too large for one map. Zoom in a little and try again.',
  RENDER_FAILED: 'Something went wrong while drawing your map. Your design is safe — please try again.',
  EXPORT_FAILED: "We couldn't prepare your file. Please try again.",
  PAYMENT_FAILED: "The payment didn't go through. You have not been charged.",
  PRINT_PROVIDER_UNAVAILABLE: "Our print partner isn't responding. Your order is saved and we'll retry.",
  AI_FAILED: 'Smart suggestions are unavailable right now. Everything else still works.',
  RATE_LIMITED: "You're going a little fast for us. Please wait a few seconds.",
  INVALID_INPUT: "Something about that request didn't look right.",
  NOT_FOUND: "We couldn't find that.",
  UNAUTHORIZED: "You don't have access to that.",
  INTERNAL: 'Something went wrong on our side. Please try again.',
} as const;
export type ErrorCode = keyof typeof ERROR_MESSAGES;

const STATUS: Record<ErrorCode, number> = {
  ADDRESS_NOT_FOUND: 404,
  GEOCODER_UNAVAILABLE: 503,
  GEODATA_UNAVAILABLE: 503,
  NO_GEODATA: 422,
  AREA_TOO_LARGE: 422,
  RENDER_FAILED: 500,
  EXPORT_FAILED: 500,
  PAYMENT_FAILED: 402,
  PRINT_PROVIDER_UNAVAILABLE: 503,
  AI_FAILED: 503,
  RATE_LIMITED: 429,
  INVALID_INPUT: 400,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  /** Internal detail for logs only. Must never include a customer's address. */
  readonly detail?: string;
  constructor(code: ErrorCode, detail?: string) {
    super(ERROR_MESSAGES[code]);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    this.detail = detail;
  }
  toJSON() {
    return { error: { code: this.code, message: this.message } };
  }
}

export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  return new AppError('INTERNAL', err instanceof Error ? err.message : String(err));
}
