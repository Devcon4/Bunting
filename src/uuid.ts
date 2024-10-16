
import { v4 } from 'uuid';

export const uuid = v4;
export type uuid = ReturnType<typeof uuid>;