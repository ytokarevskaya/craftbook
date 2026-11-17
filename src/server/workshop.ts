import 'server-only';
import { InventoryError } from '@/modules/inventory/service';
import { inventoryFailure } from './inventory';
import { ZodError } from 'zod';
import { WorkError } from '@/modules/workshop/service';
import { json } from './http';
import { documentFailure,documentDeps } from './documents';
export const workDeps=documentDeps;
export function workFailure(error:unknown){
 if(error instanceof InventoryError)return inventoryFailure(error);
 if(error instanceof WorkError){const messages:Record<string,string>={OWN_UNAVAILABLE:'Vlastní výrobní cyklus zatím není dostupný.',NOT_FOUND:'Záznam nebyl nalezen nebo k němu nemáte přístup.',CONFLICT:'Záznam se mezitím změnil. Rozepsané údaje zůstaly zachované. Načtěte aktuální verzi a změnu znovu potvrďte.',PROCEDURE_CHANGED:'Vzor se od výběru změnil. Prohlédněte aktuální podobu a výslovně potvrďte revizi; váš návrh se nepřepsal.',ARCHIVED:'Archivovaný postup nelze použít pro nový výrobek ani upravovat.',DONE:'Dokončený výrobek má kroky pouze pro čtení. Deník, fotografie a skutečnost můžete doplnit.',STATE:'Tato změna není v aktuálním stavu výrobku povolená.',ASSET_UNAVAILABLE:'Příloha není ověřená nebo k ní nemáte přístup.',PROCEDURE_SAVED:'Nový postup už byl uložen. Na detailu výrobku najdete odkaz.',INVALID_CONTENT:'Obsah zápisu není platný nebo překračuje limit.',MATERIAL_HISTORY:'Materiál s rezervací nebo historií vypořádání nelze odstranit. Potvrďte ho jako nepoužitý nebo upravte jeho skutečnost.',ARCHIVED_PRODUCT:'Nejprve obnovte archivovaný výrobek.',MATERIAL_UNIT:'U přiřazeného nebo vypořádaného materiálu neměňte typ, jednotku ani strukturovanou specifikaci. Pro jiný materiál přidejte nový řádek.',VALIDATION:'Zkontrolujte množství, jednotky a ostatní údaje.'};return json({code:error.code,message:messages[error.code]??'Změnu nelze provést.'},error.status);}
 if(error instanceof ZodError)return json({code:'VALIDATION_ERROR',message:'Zkontrolujte povinný název, texty a množství. Kovy jsou v g (nejvýše 3 desetinná místa), kameny a součástky v celých ks. U vlastní skutečnosti vyplňte a potvrďte všechny složky odběru.'},400);
 return documentFailure(error);
}
