import 'server-only';
import sharp from 'sharp';
import { fromBuffer, type ZipFile, type Entry } from 'yauzl';
import { XMLValidator } from 'fast-xml-parser';
import { createHash } from 'node:crypto';
import { FileError, fileLimits, types } from './config';
export function fileDeclaration(name:string,mime:string,bytes:number){
 const ext=name.split('.').pop()?.toLowerCase()??'';
 if(!types[ext]||types[ext]!==mime||!name||name.length>200||/[\u0000-\u001f/\\]/.test(name))throw new FileError();
 const max=mime.startsWith('image/')?fileLimits().imageBytes:fileLimits().documentBytes;
 if(!Number.isInteger(bytes)||bytes<=0||bytes>max)throw new FileError('FILE_LIMIT',413);
}
async function docx(buffer:Buffer){
 await new Promise<void>((resolve,reject)=>{
  let zip:ZipFile|undefined;let total=0,count=0;const found=new Set<string>();
  const timer=setTimeout(()=>fail(),5000);
  function fail(){clearTimeout(timer);zip?.close();reject(new FileError());}
  fromBuffer(buffer,{lazyEntries:true,validateEntrySizes:true},(error,value)=>{
   if(error||!value)return fail();zip=value;
   zip.on('error',fail);zip.on('end',()=>{clearTimeout(timer);if(['[Content_Types].xml','_rels/.rels','word/document.xml'].every(n=>found.has(n)))resolve();else fail();});
   zip.on('entry',(entry:Entry)=>{
    if(++count>512||(total+=entry.uncompressedSize)>20971520||entry.uncompressedSize>5242880||entry.generalPurposeBitFlag&1||/vbaProject|\.exe$|\.bin$/i.test(entry.fileName))return fail();
    if(entry.fileName.endsWith('/')){zip!.readEntry();return;}
    zip!.openReadStream(entry,(err,stream)=>{
     if(err||!stream)return fail();let size=0;const chunks:Buffer[]=[];
     const xml=entry.fileName.endsWith('.xml')||entry.fileName.endsWith('.rels');
     stream.on('error',fail);stream.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>entry.uncompressedSize||size>5242880||(xml&&size>1048576)){stream.destroy();fail();}else if(xml)chunks.push(chunk);});
     stream.on('end',()=>{if(xml){const text=Buffer.concat(chunks).toString('utf8');if(/<!DOCTYPE|<!ENTITY/i.test(text)||XMLValidator.validate(text)!==true)return fail();if(entry.fileName==='word/document.xml'&&!/<(?:\w+:)?document[\s>]/.test(text))return fail();if(entry.fileName==='[Content_Types].xml'&&!text.includes('wordprocessingml.document.main+xml'))return fail();}found.add(entry.fileName);zip!.readEntry();});
    });
   });zip.readEntry();
  });
 });
}
export async function validateFile(buffer:Buffer,name:string,mime:string,bytes:number){
 fileDeclaration(name,mime,bytes);if(buffer.length!==bytes)throw new FileError();
 try{
  if(mime.startsWith('image/')){
   const decoder=sharp(buffer,{limitInputPixels:4000000,failOn:'warning',animated:false}).timeout({seconds:5});
   const m=await decoder.metadata();const format:Record<string,string>={jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
   if(format[m.format??'']!==mime||!m.width||!m.height||Math.max(m.width,m.height)>2000||(m.pages??1)>1)throw new FileError();
   await decoder.raw().toBuffer();
  }else if(mime==='application/pdf'){if(!buffer.subarray(0,8).toString('ascii').match(/^%PDF-1\.[0-9]|^%PDF-2\.0/)||!buffer.subarray(-2048).includes(Buffer.from('%%EOF')))throw new FileError();}
  else if(mime==='text/markdown'){const text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))throw new FileError();}
  else await docx(buffer);
 }catch{throw new FileError();}
 return createHash('sha256').update(buffer).digest('hex');
}
