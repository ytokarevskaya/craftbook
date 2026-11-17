/* eslint-disable @next/next/no-location-assign-relative-destination -- Full navigation clears private router cache after mutation. */
'use client';
import { useEditor,EditorContent } from '@tiptap/react';
import { Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { useEffect,useRef,useState } from 'react';
import { emptyBody,safeHref,type NoteBody } from '@/modules/documents/content';
import { api,optimizeImage,uploadFile } from './upload';
const AssetImage=Node.create({name:'assetImage',group:'block',atom:true,addAttributes(){return {assetId:{default:null},alt:{default:''}};},parseHTML(){return [];},renderHTML({node}){return ['img',{src:`/api/assets/${node.attrs.assetId}/content`,alt:node.attrs.alt}];}});
export function NoteEditor({initial}:{initial?:{id:string;title:string;body:NoteBody;version:number}}){
 const [id]=useState(()=>initial?.id??crypto.randomUUID());const [title,setTitle]=useState(initial?.title??'');const [dirty,setDirty]=useState(false);const dirtyRef=useRef(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');const alert=useRef<HTMLParagraphElement>(null);const [pendingAsset,setPendingAsset]=useState<string>();
 const editor=useEditor({extensions:[StarterKit.configure({heading:{levels:[2,3]},blockquote:false,code:false,codeBlock:false,horizontalRule:false,strike:false,underline:false,link:{openOnClick:false,autolink:false,linkOnPaste:false,isAllowedUri:safeHref}}),AssetImage],content:initial?.body.doc??emptyBody.doc,immediatelyRender:false,editorProps:{attributes:{role:'textbox','aria-label':'Obsah poznámky','aria-multiline':'true'},handleDrop:()=>true},onUpdate:()=>setDirty(true)});
 useEffect(()=>{editor?.setEditable(!busy,false);},[editor,busy]);
 useEffect(()=>{dirtyRef.current=dirty;},[dirty]);
 useEffect(()=>{if(error)alert.current?.focus();},[error]);
 useEffect(()=>{
  const unload=(event:BeforeUnloadEvent)=>{if(dirtyRef.current){event.preventDefault();event.returnValue='';}};
  const click=(event:MouseEvent)=>{const a=(event.target as Element).closest('a');if(dirtyRef.current&&a?.href&&!a.href.startsWith('mailto:')&&!window.confirm('Máte neuložené změny. Opravdu opustit editaci?')){event.preventDefault();event.stopPropagation();}};
  window.addEventListener('beforeunload',unload);document.addEventListener('click',click,true);return()=>{window.removeEventListener('beforeunload',unload);document.removeEventListener('click',click,true);};
 },[]);
 async function save(){if(!editor||busy)return;setBusy(true);setError('');try{await api('/api/documents',{id,title,kind:'note',body:{version:1,doc:editor.getJSON()},...(initial?{version:initial.version}:{})});dirtyRef.current=false;window.location.assign(`/documents/${id}`);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function addImage(file?:File){if(!file||!editor)return;setBusy(true);setError('');try{const optimized=await optimizeImage(file);const id=await uploadFile(optimized,setMessage,setPendingAsset);editor.chain().focus().insertContent({type:'assetImage',attrs:{assetId:id,alt:''}}).run();setPendingAsset(undefined);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function retry(){if(!pendingAsset||!editor)return;setBusy(true);try{await api(`/api/assets/${pendingAsset}/finalize`);editor.chain().focus().insertContent({type:'assetImage',attrs:{assetId:pendingAsset,alt:''}}).run();setPendingAsset(undefined);setError('');setMessage('Obrázek ověřen. Uložte poznámku.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 if(!editor)return <p role="status">Připravuji editor…</p>;
 return <section className="panel document-form"><label htmlFor="note-title">Název poznámky</label><input id="note-title" disabled={busy} value={title} maxLength={180} onChange={e=>{setTitle(e.target.value);setDirty(true);}}/>
 <div className="editor-toolbar" role="group" aria-label="Formátování poznámky">
 <button type="button" onClick={()=>editor.chain().focus().setParagraph().run()}>Odstavec</button><button type="button" onClick={()=>editor.chain().focus().toggleHeading({level:2}).run()}>Nadpis</button>
 <button type="button" onClick={()=>editor.chain().focus().toggleBold().run()} aria-label="Tučné"><b>B</b></button><button type="button" onClick={()=>editor.chain().focus().toggleItalic().run()} aria-label="Kurzíva"><i>I</i></button>
 <button type="button" onClick={()=>editor.chain().focus().toggleBulletList().run()}>Odrážky</button><button type="button" onClick={()=>editor.chain().focus().toggleOrderedList().run()}>Číslování</button>
 <button type="button" onClick={()=>{const href=window.prompt('Odkaz (https://, http:// nebo mailto:). Prázdné pole odkaz odstraní.');if(href===null)return;if(href==='')editor.chain().focus().unsetLink().run();else if(safeHref(href))editor.chain().focus().setLink({href}).run();else setError('Použijte bezpečný odkaz https://, http:// nebo mailto:.');}}>Odkaz</button>
 <button type="button" onClick={()=>editor.chain().focus().undo().run()}>Zpět</button><button type="button" onClick={()=>editor.chain().focus().redo().run()}>Vpřed</button></div>
 <EditorContent editor={editor}/><label htmlFor="note-image">Vložit obrázek</label><input id="note-image" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{void addImage(e.target.files?.[0]);e.target.value='';}}/>
 <p className="muted small">JPEG, PNG nebo WebP; vstup nejvýše 20 MiB / 40 megapixelů. Ukládá se optimalizovaná kopie do 2000 px a 5 MiB. HEIC exportujte jako JPEG.</p>
 <p role="status">{message|| (dirty?'Máte neuložené změny.':'Změny ukládejte tlačítkem Uložit.')}</p>{error&&<p className="form-message error" role="alert" tabIndex={-1} ref={alert}>{error}</p>}
 <div className="document-actions"><button className="primary-button" disabled={busy} onClick={save}>{busy?'Pracuji…':'Uložit poznámku'}</button>{pendingAsset&&<button disabled={busy} onClick={retry}>Opakovat ověření obrázku</button>}{initial&&<button onClick={()=>{if(window.confirm('Zahodit rozepsané změny a načíst aktuální verzi?')){dirtyRef.current=false;window.location.reload();}}}>Načíst aktuální verzi</button>}<a href={initial?`/documents/${id}`:'/documents'}>Zpět bez uložení</a></div></section>;
}
