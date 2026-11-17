// Fixed-point arithmetic: BigInt only for quantities, shares and CZK.
export const SHARE=15;
export function units(value:string,scale:number):bigint{const negative=value.startsWith('-'),[a,b='']=(negative?value.slice(1):value).split('.');if(!/^\d+$/.test(a)||!/^[0-9]*$/.test(b)||b.length>scale)throw new Error('DECIMAL');return (negative?-1n:1n)*BigInt(a+b.padEnd(scale,'0'));}
export function fixed(value:bigint,scale:number):string{const sign=value<0n?'-':'',s=(value<0n?-value:value).toString().padStart(scale+1,'0');return sign+(scale?s.slice(0,-scale)+'.'+s.slice(-scale):s);}
export function round(n:bigint,d:bigint):bigint{if(d<=0n)throw new Error('DIVISION');return n<0n?-round(-n,d):(n+d/2n)/d;}
export function normalize(value:string,scale:number,digits:number):string{const s=value.trim().replace(',','.');if(!new RegExp(`^(0|[1-9][0-9]{0,${digits-1}})(\\.[0-9]{1,${scale}})?$`).test(s))throw new Error('DECIMAL');return fixed(units(s,scale),scale);}
export const components=['free_quantity','free_known_quantity','free_unknown_quantity','free_known_value','reserved_quantity','reserved_known_quantity','reserved_unknown_quantity','reserved_known_value'] as const;
export type Component=typeof components[number];
export type Amounts=Record<Component,string>;
export const scales:Record<Component,number>={free_quantity:3,free_known_quantity:15,free_unknown_quantity:15,free_known_value:6,reserved_quantity:3,reserved_known_quantity:15,reserved_unknown_quantity:15,reserved_known_value:6};
export function zero():Amounts{return Object.fromEntries(components.map(k=>[k,fixed(0n,scales[k])])) as Amounts;}
export function receive(q:string,cost:string|null):Amounts{return {...zero(),free_quantity:fixed(units(q,3),3),free_known_quantity:fixed(cost===null?0n:units(q,15),15),free_unknown_quantity:fixed(cost===null?units(q,15):0n,15),free_known_value:cost??'0.000000'};}
export function withdraw(b:Amounts,q:string):Amounts{const physical=units(q,3),total=units(b.free_quantity,3);if(physical<=0n||physical>total)throw new Error('STOCK_SHORTAGE');const take=units(q,15),known=units(b.free_known_quantity,15),unknown=units(b.free_unknown_quantity,15),value=units(b.free_known_value,6);let k=round(known*physical,total);if(k>known)k=known;if(k>take)k=take;if(take-k>unknown)k=take-unknown;const v=k===known?value:round(value*k,known);return {...zero(),free_quantity:fixed(-physical,3),free_known_quantity:fixed(-k,15),free_unknown_quantity:fixed(-(take-k),15),free_known_value:fixed(-v,6)};}
export function add(a:Amounts,b:Amounts):Amounts{const out=zero();for(const k of components){const n=units(a[k],scales[k])+units(b[k],scales[k]);if(n<0n||n>=10n**BigInt(k.endsWith('value')?20:k.endsWith('_quantity')&&!k.includes('known')?18:30))throw new Error('NUMERIC_LIMIT');out[k]=fixed(n,scales[k]);}return out;}
export function formatQuantity(v:string){return v.replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'').replace('.',',');}
export function formatMoney(v:string){return fixed(round(units(v,6),10000n),2).replace('.',',')+' Kč';}
export function average(value:string,q:string){const n=units(q,15);return n===0n?null:fixed(round(units(value,6)*10n**15n,n),6);}
