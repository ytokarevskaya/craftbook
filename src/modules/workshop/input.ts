import { reservationTargets } from '../inventory/reservation-input';
import { z } from 'zod';
import { titleInput,uuid } from '../documents/content';
export function decimal(value:string,scale:number,integerDigits:number){
 if(!new RegExp(`^(?:0|[1-9][0-9]{0,${integerDigits-1}})(?:\\.[0-9]{1,${scale}})?$`).test(value))throw new Error('DECIMAL');
 const [integer,fraction='']=value.split('.');const rest=fraction.replace(/0+$/,'');return integer+(rest?'.'+rest:'');
}
export const quantity=z.string().max(20).transform((s,c)=>{try{return decimal(s,3,15);}catch{c.addIssue({code:'custom',message:'Množství musí být nezáporné číslo s nejvýše 3 desetinnými místy.'});return z.NEVER;}}).nullable();
export const money=z.string().max(22).transform((s,c)=>{try{return decimal(s,6,14);}catch{c.addIssue({code:'custom',message:'Cena musí být nezáporné číslo s nejvýše 6 desetinnými místy.'});return z.NEVER;}}).nullable();
const text=z.string().trim().min(1).max(4000).refine(s=>!s.includes('\0'));
export const stepInput=z.object({id:uuid,text}).strict();
export const materialRequirements=z.object({alloy:z.string().max(1000).optional(),fineness:z.string().max(1000).optional(),form:z.string().max(1000).optional(),profile:z.string().max(1000).optional(),dimensions:z.string().max(1000).optional()}).strict();
export const materialInput=z.object({requirements:materialRequirements.optional(),id:uuid,specification:z.string().trim().min(1).max(1000),type:z.enum(['metal','stone','component']),unit:z.enum(['g','ks']),quantity}).strict().superRefine((v,c)=>{if((v.type==='metal')!==(v.unit==='g')||(v.unit==='ks'&&v.quantity?.includes('.')))c.addIssue({code:'custom',message:'Kovy jsou v g, kameny a součástky v celých ks.'});});
export const planInput=z.object({title:titleInput,description:z.string().max(10000).default(''),steps:z.array(stepInput).max(200),materials:z.array(materialInput).max(200),attachments:z.array(uuid).max(30).default([])}).strict().superRefine((p,c)=>{for(const rows of [p.steps,p.materials])if(new Set(rows.map(r=>r.id)).size!==rows.length)c.addIssue({code:'custom',message:'Řádky musí mít různá ID.'});if(new Set(p.attachments).size!==p.attachments.length)c.addIssue({code:'custom',message:'Přílohy se nesmějí opakovat.'});});
export type Plan=z.infer<typeof planInput>;
export const procedureInput=z.object({id:uuid,version:z.number().int().positive().optional(),plan:planInput}).strict();
export const productInput=z.object({id:uuid,version:z.number().int().positive().optional(),source:z.enum(['school','own']),procedureId:uuid.nullable(),procedureRevision:z.number().int().positive().nullable(),plan:planInput}).strict();
export const commandInput=z.object({requestKey:uuid,version:z.number().int().positive(),reservations:reservationTargets.optional(),expectedProcedureRevision:z.number().int().positive().nullable().optional()}).strict();
export const actualInput=z.array(z.object({id:uuid,quantity,confirmed:z.boolean()}).strict()).max(200);
export function progress(steps:{is_completed:boolean}[]){const total=steps.length,completed=steps.filter(s=>s.is_completed).length;return {total,completed,percent:total?Math.round(completed/total*100):null};}
export const stateLabels={planned:'Plánovaný',in_progress:'Rozpracovaný',done:'Dokončený'};
export function displayDecimal(value:string|null){if(value===null)return 'Neznámé';const [a,b='']=value.split('.');const rest=b.replace(/0+$/,'');return a+(rest?','+rest:'');}
