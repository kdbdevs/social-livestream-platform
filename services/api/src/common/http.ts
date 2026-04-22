export function successResponse<T>(data: T, meta?: Record<string, unknown>): { success: true; data: T; meta?: Record<string, unknown> } {
  if (meta) {
    return {
      success: true,
      data,
      meta,
    };
  }

  return {
    success: true,
    data,
  };
}

