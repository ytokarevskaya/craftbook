/* eslint-disable @next/next/no-img-element -- Private endpoint verifies the current account on every image request. */
import { createElement,type ReactNode } from 'react';
import { validateBody,type NoteNode } from '@/modules/documents/content';
function render(n:NoteNode,key:number):ReactNode{
 if(n.type==='text'){let text:ReactNode=n.text;for(const m of n.marks??[]){if(m.type==='bold')text=<strong>{text}</strong>;if(m.type==='italic')text=<em>{text}</em>;if(m.type==='link')text=<a href={m.attrs!.href!} rel="noopener noreferrer" target="_blank">{text}</a>;}return <span key={key}>{text}</span>;}
 if(n.type==='assetImage')return <figure key={key}><img src={`/api/assets/${n.attrs!.assetId}/content`} alt={String(n.attrs!.alt??'')} loading="lazy"/></figure>;
 const tags:Record<string,string>={doc:'div',paragraph:'p',heading:n.attrs?.level===3?'h3':'h2',bulletList:'ul',orderedList:'ol',listItem:'li',hardBreak:'br'};
 return createElement(tags[n.type],{key},n.content?.map(render));
}
export function NoteRenderer({body}:{body:unknown}){const valid=validateBody(body);return <div className="note-content">{render(valid.body.doc,0)}</div>;}
