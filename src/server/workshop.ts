import 'server-only';
import { ZodError } from 'zod';
import { WorkError } from '@/modules/workshop/service';
import { json } from './http';
import { documentFailure,documentDeps } from './documents';
export const workDeps=documentDeps;
export function workFailure(error:unknown){
 if(error instanceof WorkError){const messages:Record<string,string>={NOT_FOUND:'Záznam nebyl nalezen nebo k němu nemáte přístup.',CONFLICT:'Záznam se mezitím změnil. Rozepsané údaje zůstaly zachované. Načtěte aktuální verzi a změnu znovu potvrďte.',PROCEDURE_CHANGED:'Vzor se od výběru změnil. Prohlédněte aktuální podobu a výslovně potvrďte revizi; váš návrh se nepřepsal.',ARCHIVED:'Archivovaný postup nelze použít pro nový výrobek ani upravovat.',DONE:'Dokončený výrobek má kroky pouze pro čtení. Deník, fotografie a skutečnost můžete doplnit.',STATE:'Tato změna není v aktuálním stavu výrobku povolená.',ASSET_UNAVAILABLE:'Příloha není ověřená nebo k ní nemáte přístup.',PROCEDURE_SAVED:'Nový postup už byl uložen. Na detailu výrobku najdete odkaz.',INVALID_CONTENT:'Obsah zápisu není platný nebo překračuje limit.',MATERIAL_UNIT:'U materiálu s potvrzenou skutečností neměňte typ ani jednotku. Přidejte nový řádek.',VALIDATION:'Zkontrolujte množství, jednotky a ostatní údaje.'};return json({code:error.code,message:messages[error.code]??'Změnu nelze provést.'},error.status);}
 if(error instanceof ZodError)return json({code:'VALIDATION_ERROR',message:'Zkontrolujte povinný název, texty a množství. Kovy jsou v g (nejvýše 3 desetinná místa), kameny a součástky v celých ks. Podporován je pouze školní materiál.'},400);
 return documentFailure(error);
}
