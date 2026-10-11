// One-time migration from the versioned static source. JSX becomes the editable source.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'parse5';
const root=process.cwd(), source=path.join(root,'dist');
if(!fs.existsSync(source)) throw Error('Original dist source required; do not run on the migrated project.');
const write=(name,text)=>{fs.mkdirSync(path.dirname(name),{recursive:true});fs.writeFileSync(name,text);};
const attr=(n,key)=>n.attrs?.find(a=>a.name===key)?.value;
const children=n=>n.childNodes || [];
const text=n=>n.nodeName==='#text'?n.value:children(n).map(text).join('');
const walk=(n,fn)=>{fn(n);children(n).forEach(c=>walk(c,fn));};
const boolean=new Set('hidden disabled checked selected multiple required readonly autofocus controls loop muted autoplay open novalidate formnovalidate reversed allowfullscreen download'.split(' '));
const names={class:'className',for:'htmlFor',tabindex:'tabIndex',readonly:'readOnly',autofocus:'autoFocus',maxlength:'maxLength',minlength:'minLength',colspan:'colSpan',rowspan:'rowSpan',cellpadding:'cellPadding',cellspacing:'cellSpacing',allowfullscreen:'allowFullScreen',frameborder:'frameBorder',crossorigin:'crossOrigin',srcset:'srcSet',usemap:'useMap',contenteditable:'contentEditable',spellcheck:'spellCheck',autocomplete:'autoComplete',novalidate:'noValidate',formnovalidate:'formNoValidate',autoplay:'autoPlay',viewbox:'viewBox',preserveaspectratio:'preserveAspectRatio'};
const voids=new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const cssName=s=>s.startsWith('--')?s:s.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
function jsx(n){
 if(n.nodeName==='#text')return n.value.trim()?'{'+JSON.stringify(n.value)+'}':'\n';
 if(!n.tagName||['script','style'].includes(n.tagName))return '';
 const tag=n.tagName;let props=[];
 for(const a of n.attrs||[]){let key=a.name,value=a.value;if(key.startsWith('on')||key==='selected')continue;
   if(key==='style'){const style={};for(const declaration of value.split(';')){const i=declaration.indexOf(':');if(i>0)style[cssName(declaration.slice(0,i).trim())]=declaration.slice(i+1).trim();}props.push('style={'+JSON.stringify(style)+'}');continue;}
   key=names[key]||key;
   if(a.name==='checked')key='defaultChecked';
   if(a.name==='value'&&['input','select','textarea'].includes(tag))key='defaultValue';
   if(n.namespaceURI?.includes('svg')&&!key.startsWith('aria-')&&!key.startsWith('data-'))key=cssName(key);
   props.push(key+'={'+(boolean.has(a.name)&&value===''?'true':JSON.stringify(value))+'}');
 }
 if(tag==='select'&&!props.some(p=>p.startsWith('defaultValue'))){let selected;walk(n,c=>{if(attr(c,'selected')!==undefined)selected=attr(c,'value')??text(c);});if(selected!==undefined)props.push('defaultValue={'+JSON.stringify(selected)+'}');}
 if(tag==='textarea')props.push('defaultValue={'+JSON.stringify(text(n))+'}');
 const opening='<'+tag+(props.length?' '+props.join(' '):'');
 return voids.has(tag)?opening+' />':opening+'>'+(tag==='textarea'?'':children(n).map(jsx).join(''))+'</'+tag+'>';
}
fs.cpSync(source,path.join(root,'public'),{recursive:true});
const registry={};
for(const file of fs.readdirSync(source).filter(f=>f.endsWith('.html'))){
 const slug=file.slice(0,-5),doc=parse(fs.readFileSync(path.join(source,file),'utf8'));
 let body,head;walk(doc,n=>{if(n.tagName==='body')body=n;if(n.tagName==='head')head=n;});
 const scripts=[],inline=[],styles=[],links=[];let title=slug;
 walk(doc,n=>{if(n.tagName==='script'){if(attr(n,'src'))scripts.push({src:attr(n,'src')});else {scripts.push({inline:inline.length});inline.push(text(n));}}if(n.tagName==='style')styles.push(text(n));});
 walk(head,n=>{if(n.tagName==='title')title=text(n);if(n.tagName==='link'&&attr(n,'rel')==='stylesheet')links.push({href:attr(n,'href')});});
 const component=slug==='index'?'FlightWorkspace':slug.split(/[-_]/).map(s=>s[0].toUpperCase()+s.slice(1)).join('')+'View';
 const components=[];let bodyJsx;
 if(slug==='index'){
   const main=children(body).find(n=>n.tagName==='main');
   const nodes=children(main).filter(n=>n.tagName);const used=new Set();
   const markup=nodes.map((n,i)=>{let name=(attr(n,'id')||attr(n,'class')?.split(' ')[0]||'WorkspacePart'+i).replace(/(^|[-_])([a-z])/g,(_,p,c)=>c.toUpperCase()).replace(/[^a-zA-Z0-9]/g,'');if(used.has(name))name+=i;used.add(name);components.push('function '+name+'(){return ('+jsx(n)+');}');return '<'+name+' />';}).join('\n');
   bodyJsx='<main className="app">'+markup+'</main>'+children(body).filter(n=>n!==main).map(jsx).join('');
 }else bodyJsx=children(body).map(jsx).join('');
 write(path.join(root,'src/views',slug+'.jsx'),'// React view; original controls and IDs are preserved for the flight engine.\n'+components.join('\n\n')+'\nexport default function '+component+'(){return (<>'+links.map(l=>'<link rel="stylesheet" href={'+JSON.stringify(l.href)+'} />').join('')+'<style>{'+JSON.stringify(styles.join('\n'))+'}</style>'+bodyJsx+'</>);}\n');
 // Browser engines run after React hydration. External data scripts retain their established order.
 const lines=['export async function start(loadScript) {'];
 for(const s of scripts){if(s.src)lines.push('await loadScript('+JSON.stringify(s.src)+');');else lines.push(inline[s.inline]);}
 lines.push('}\n');
 // Await init so failures and readiness are observable rather than hidden behind script insertion.
 let runtime=lines.join('\n').replace('void init();','await init();');
 write(path.join(root,'src/runtime',slug+'.js'),runtime);
 registry[slug]={title,bodyClass:attr(body,'class')||'',bodyStyle:attr(body,'style')||''};
 fs.unlinkSync(path.join(root,'public',file));
}
write(path.join(root,'src/pages.json'),JSON.stringify(registry,null,2));
write(path.join(root,'src/views/registry.js'),Object.keys(registry).map((slug,i)=>'import View'+i+' from "./'+slug+'";').join('\n')+'\nexport const views={'+Object.keys(registry).map((slug,i)=>JSON.stringify(slug)+':View'+i).join(',')+'};\n');
write(path.join(root,'src/runtime/loaders.js'),'export const engines={'+Object.keys(registry).map(slug=>JSON.stringify(slug)+':()=>import("./'+slug+'.js")').join(',')+'};\n');
console.log('Migrated '+Object.keys(registry).length+' React pages and browser engines. Original dist retained until validation.');
