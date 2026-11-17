'use client';
export async function api<T>(url:string,body?:unknown,method='POST'):Promise<T>{
 let r:Response;
 try{r=await fetch(url,{method,headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});}catch{throw new Error('Spojení se přerušilo. Rozepsané změny zůstaly zachované; zkuste operaci znovu.');}
 let data;try{data=await r.json();}catch{throw new Error('Odpověď serveru se nepodařilo načíst. Zkuste operaci znovu.');}
 if(!r.ok)throw new Error(data.message??'Operace se nezdařila.');return data;
}
export async function optimizeImage(file:File):Promise<File>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Použijte JPEG, PNG nebo WebP. HEIC nejprve exportujte jako JPEG.');
 if(file.size>20971520)throw new Error('Vstupní fotografie může mít nejvýše 20 MiB.');
 let bitmap:ImageBitmap;try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw new Error('Obrázek nelze otevřít. Použijte platný JPEG, PNG nebo WebP.');}
 try{if(bitmap.width*bitmap.height>40000000)throw new Error('Fotografie může mít nejvýše 40 megapixelů.');const scale=Math.min(1,2000/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Fotografii nelze zpracovat.')),'image/webp',0.86));return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.webp',{type:'image/webp'});}finally{bitmap.close();}
}
export async function uploadFile(file:File,status:(s:string)=>void,onPrepared?:(id:string)=>void){
 const mime=file.name.toLowerCase().endsWith('.md')?'text/markdown':file.type;
 status('Připravuji nahrávání…');const prepared=await api<{id:string;url:string}>('/api/assets/prepare',{name:file.name,mime,bytes:file.size});onPrepared?.(prepared.id);
 status('Nahrávám soubor…');let r:Response;try{r=await fetch(prepared.url,{method:'PUT',headers:{'Content-Type':mime,'Cache-Control':'no-store','x-upsert':'false'},body:file});}catch{throw new Error('Nahrávání se přerušilo. Zkuste ověření nebo vyberte soubor znovu.');}if(!r.ok)throw new Error('Nahrávání se nezdařilo. Zvolte soubor znovu; pokud přenos doběhl, můžete opakovat ověření.');
 status('Ověřuji soubor…');await api(`/api/assets/${prepared.id}/finalize`);status('Soubor byl ověřen. Uložte dokument.');return prepared.id;
}
