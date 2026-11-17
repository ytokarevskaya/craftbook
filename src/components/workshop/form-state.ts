'use client';
import { useEffect,useRef,useState } from 'react';
export function useWorkForm(){const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');const dirtyRef=useRef(false),alert=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{dirtyRef.current=dirty;},[dirty]);useEffect(()=>{if(error)alert.current?.focus();},[error]);
 useEffect(()=>{const before=(e:BeforeUnloadEvent)=>{if(dirtyRef.current){e.preventDefault();e.returnValue='';}};const click=(e:MouseEvent)=>{if(dirtyRef.current&&(e.target as Element).closest('a')&&!window.confirm('Máte neuložené změny. Opravdu odejít?')){e.preventDefault();e.stopPropagation();}};window.addEventListener('beforeunload',before);document.addEventListener('click',click,true);return()=>{window.removeEventListener('beforeunload',before);document.removeEventListener('click',click,true);};},[]);
 return {dirty,setDirty,busy,setBusy,error,setError,allowNavigation:()=>{dirtyRef.current=false;},alert};}
