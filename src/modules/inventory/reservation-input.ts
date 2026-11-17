import { z } from 'zod';
import { id,quantity } from './input';
export const reservationTarget=z.object({materialId:id,itemId:id.nullable(),quantity:quantity.nullable(),reserveEnabled:z.boolean(),confirmed:z.boolean(),cardVersion:z.number().int().positive().nullable()}).strict().transform(v=>({...v,reserveEnabled:v.quantity!==null&&v.reserveEnabled}));
export const reservationTargets=z.array(reservationTarget).max(200).superRefine((v,c)=>{if(new Set(v.map(a=>a.materialId)).size!==v.length)c.addIssue({code:'custom',message:'Materiálové řádky se nesmějí opakovat.'});});
export type ReservationTarget=z.infer<typeof reservationTarget>;
