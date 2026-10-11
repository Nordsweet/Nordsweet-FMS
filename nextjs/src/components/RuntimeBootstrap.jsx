'use client';
import { useEffect, useState } from 'react';
import { engines } from '../runtime/loaders';

const scripts=new Map();
function loadScript(src){
  const url=new URL(src,location.href).href;
  if(!scripts.has(url)) scripts.set(url,new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=url;script.async=false;
    script.onload=resolve;script.onerror=()=>reject(new Error('Cannot load '+src));
    document.head.appendChild(script);
  }));
  return scripts.get(url);
}
export default function RuntimeBootstrap({page,bodyClass='',bodyStyle=''}){
  const [error,setError]=useState('');
  useEffect(()=>{
    document.body.className=bodyClass;
    if(bodyStyle)document.body.setAttribute('style',bodyStyle);
    // Each existing tool uses document-level events. Navigation between tools is a full
    // document navigation, so one initialization per document also handles Strict Mode.
    window.__nordsweetBoots ??= {};
    window.__nordsweetBoots[page] ??= engines[page]().then(engine=>engine.start(loadScript)).then(()=>{
      document.documentElement.dataset.nordsweetReady=page;
    });
    let active=true;
    window.__nordsweetBoots[page].catch(e=>{console.error(e);if(active)setError('Nie udało się uruchomić aplikacji. Odśwież stronę.');});
    return ()=>{active=false;};
  },[page,bodyClass,bodyStyle]);
  return error?<div role="alert" style={{position:'fixed',top:0,left:0,right:0,zIndex:100000,padding:16,background:'#8b2020',color:'white'}}>{error}</div>:null;
}
