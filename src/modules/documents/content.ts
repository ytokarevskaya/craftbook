import { z } from 'zod';
export const titleInput=z.string().trim().min(1).max(180).refine(s=>!/[\u0000-\u001f]/.test(s));
export const uuid=z.uuid();
export type NoteNode={type:string;text?:string;attrs?:Record<string,string|number>;marks?:{type:string;attrs?:Record<string,string|null>}[];content?:NoteNode[]};
export type NoteBody={version:1;doc:NoteNode};
export const emptyBody:NoteBody={version:1,doc:{type:'doc',content:[{type:'paragraph'}]}};
export function safeHref(value:string) { try {const url=new URL(value);return ['https:','http:','mailto:'].includes(url.protocol)&&!/[\u0000-\u0020]/.test(value);}catch{return false;} }
function exact(value:object,keys:string[]){if(Object.keys(value).some(k=>!keys.includes(k)))throw new Error('CONTENT');}
export function validateBody(raw:unknown,limit=262144):{body:NoteBody;assets:string[]} {
 if(JSON.stringify(raw)?.length>limit || new TextEncoder().encode(JSON.stringify(raw)).length>limit)throw new Error('CONTENT');
 const root=z.object({version:z.literal(1),doc:z.unknown()}).strict().parse(raw);let count=0;const assets=new Set<string>();
 function visit(value:unknown,parent:string,depth:number):NoteNode {
  if(!value||typeof value!=='object'||Array.isArray(value)||++count>5000||depth>12)throw new Error('CONTENT');
  const n=value as NoteNode;exact(n,['type','text','attrs','marks','content']);
  const allowed:Record<string,string[]>={root:['doc'],doc:['paragraph','heading','bulletList','orderedList','assetImage'],paragraph:['text','hardBreak'],heading:['text','hardBreak'],bulletList:['listItem'],orderedList:['listItem'],listItem:['paragraph','bulletList','orderedList']};
  if(!allowed[parent]?.includes(n.type))throw new Error('CONTENT');
  if(n.type==='text') {if(typeof n.text!=='string'||!n.text.length||n.content||n.attrs||n.text.includes('\0'))throw new Error('CONTENT');}
  else if(n.text!==undefined||n.marks!==undefined)throw new Error('CONTENT');
  if(n.type==='assetImage'){const a=z.object({assetId:uuid,alt:z.string().max(200).default('')}).strict().parse(n.attrs);assets.add(a.assetId);if(n.content)throw new Error('CONTENT');}
  else if(n.type==='heading'){z.object({level:z.union([z.literal(2),z.literal(3)])}).strict().parse(n.attrs);}
  else if(n.type==='orderedList'){if(n.attrs)z.object({start:z.number().int().min(1).max(10000),type:z.null().optional()}).strict().parse(n.attrs);}
  else if(n.attrs!==undefined)throw new Error('CONTENT');
  if(n.marks){if(!Array.isArray(n.marks)||n.marks.length>3)throw new Error('CONTENT');for(const m of n.marks){exact(m,['type','attrs']);if(!['bold','italic','link'].includes(m.type))throw new Error('CONTENT');if(m.type==='link'){const a=z.object({href:z.string().max(2048).refine(safeHref),target:z.enum(['_blank','_self']).nullable().optional(),rel:z.string().max(100).nullable().optional(),class:z.null().optional()}).strict().parse(m.attrs);if(!a.href)throw new Error('CONTENT');}else if(m.attrs)throw new Error('CONTENT');}}
  if(n.content!==undefined){if(!Array.isArray(n.content))throw new Error('CONTENT');n.content.forEach(c=>visit(c,n.type,depth+1));}
  if(['doc','bulletList','orderedList','listItem'].includes(n.type)&&!n.content?.length)throw new Error('CONTENT');
  return n;
 }
 return {body:{version:1,doc:visit(root.doc,'root',0)},assets:[...assets]};
}
