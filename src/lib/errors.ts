export interface AppErrorField {
  path: string;
  message: string;
}

export class AppError extends Error {
  readonly status: number;
  readonly fieldErrors?: AppErrorField[];

  constructor(
    message: string,
    status = 400,
    options?: {
      fieldErrors?: AppErrorField[];
    },
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.fieldErrors = options?.fieldErrors;
  }
}
