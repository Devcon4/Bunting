
export type Ok<T> = { Ok: true, Value: T };
export type Error<E> = { Ok: false, Error: E };
export type Result<T, E> = Ok<T> | Error<E>;

export type GenericError = string;

export type InnerError<T> = {
  Message: string;
  InnerError: T;
}

//: U extends NonNullable<unknown> ? Error<InnerError<U>> : Error<T>
export const Err = <T = GenericError, U = unknown>(error: T, inner?: U): U extends NonNullable<unknown> ? Error<InnerError<U>> : Error<T> => {
  if (!inner) {
    return { Ok: false, Error: error } as any;
  }
  return { Ok: false, Error: { Message: error, InnerError: inner } } as any;
}

export const Ok = <T>(value?: T) => {
  return { Ok: true, Value: value } as Ok<T>;
}

type ExtractError<T> = T extends Error<infer U> ? U : never;
type ExtractValue<T> = T extends Ok<infer U> ? U : never;


export function Result<T extends (...args: Parameters<T>) => unknown>(func: T): (...args: Parameters<T>) => Promise<Result<ExtractValue<Awaited<ReturnType<T>>>, ExtractError<Awaited<ReturnType<T>>>>> {
  return func as any;
}


export function SyncResult<T extends (...args: Parameters<T>) => unknown>(func: T): (...args: Parameters<T>) => Result<ExtractValue<ReturnType<T>>, ExtractError<ReturnType<T>>> {
  return func as any;
}

const isInnerError = (error: any): error is InnerError<unknown> => {
  return !!error?.InnerError;
}

export const logError = <T extends Error<unknown> | InnerError<unknown>>(error: T) => {
  if (isInnerError(error)) {
    console.log('Inner Error ::', error.Message);
    logError(error.InnerError as any);
  } else {
    console.log('Error ::', error);
  }
}