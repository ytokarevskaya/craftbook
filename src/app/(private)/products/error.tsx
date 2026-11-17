'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <section className="panel document-form"><h1>Záznam se nepodařilo načíst</h1><p role="alert">Zkontrolujte připojení a dostupnost záznamu. Nejde o prázdný seznam.</p><button onClick={reset}>Zkusit znovu</button></section>;}
