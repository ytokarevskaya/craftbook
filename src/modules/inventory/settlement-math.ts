import { components,scales,zero,units,fixed,withdraw,type Amounts } from './decimal';
export type PricePart={amounts:Amounts;reservationId:string|null;card:Record<string,string>};
export const categories=['inProduct','returned','scrap','lost'] as const;
export type Categories=Record<typeof categories[number],Amounts>;
export function sumAmounts(parts:Amounts[]):Amounts{const out=zero();for(const k of components)out[k]=fixed(parts.reduce((n,p)=>n+units(p[k],scales[k]),0n),scales[k]);return out;}
export function negative(a:Amounts):Amounts{const out=zero();for(const k of components)out[k]=fixed(-units(a[k],scales[k]),scales[k]);return out;}
export function takePool(pool:Amounts,q:string){if(units(q,3)===0n)return zero();return negative(withdraw(pool,q));}
export function prefix(parts:PricePart[],quantity:string){let left=units(quantity,3);const kept:PricePart[]=[];for(const p of parts){if(left===0n)break;const available=units(p.amounts.free_quantity,3),q=left<available?left:available;kept.push({...p,amounts:takePool(p.amounts,fixed(q,3))});left-=q;}return {kept,missing:fixed(left,3)};}
export function split(pool:Amounts,quantities:Record<typeof categories[number],string>):Categories{let remaining=pool;const result={} as Categories;for(const category of categories){const a=takePool(remaining,quantities[category]);result[category]=a;remaining=sumAmounts([remaining,negative(a)]);}return result;}
export function hasAmount(a:Amounts){return components.some(k=>units(a[k],scales[k])!==0n);}
