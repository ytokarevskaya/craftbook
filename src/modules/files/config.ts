export const BUCKET='craftbook-private';
function limit(name:string,fallback:number,min:number,max:number){const n=Number(process.env[name]??fallback);if(!Number.isInteger(n)||n<min||n>max)throw new Error('FILE_CONFIG');return n;}
export function fileLimits(){return {imageBytes:limit('FILE_IMAGE_BYTES',5242880,1024,5242880),documentBytes:limit('FILE_DOCUMENT_BYTES',10485760,1024,10485760),contentBytes:limit('NOTE_CONTENT_BYTES',262144,1024,262144),downloadTtl:limit('FILE_DOWNLOAD_TTL',60,1,300),graceHours:limit('FILE_GRACE_HOURS',24,24,720),inputBytes:20971520,inputPixels:40000000,maxSide:2000};}
export const types:Record<string,string>={pdf:'application/pdf',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',md:'text/markdown',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
export class FileError extends Error {constructor(public code='INVALID_FILE',public status=400){super(code);}}
