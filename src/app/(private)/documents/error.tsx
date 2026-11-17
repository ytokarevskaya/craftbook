'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <section className="panel document-form"><h1>Dokumenty se nepodařilo načíst</h1><p role="alert">Zkontrolujte připojení a zkuste to znovu. Nejde o prázdný seznam.</p><button onClick={reset}>Zkusit znovu</button></section>;}
