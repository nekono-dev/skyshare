type ServiceErrorTag = "InternalServerError" | "BadRequest";
type ServiceResultSuccess<T> = { success: true; data: T };
type ServiceResultFailure = { success: false; error: ServiceErrorTag };
type ServiceResult<T> = ServiceResultSuccess<T> | ServiceResultFailure;

export type { ServiceResult };
