import pages from '../../src/pages.json';
import { views } from '../../src/views/registry';
import RuntimeBootstrap from '../../src/components/RuntimeBootstrap';
import { notFound } from 'next/navigation';
export const dynamicParams=false;
export function generateStaticParams(){return Object.keys(pages).filter(tool=>tool!=='index').map(tool=>({tool}));}
export async function generateMetadata({params}){const {tool}=await params;return {title:pages[tool.replace(/\.html$/,'')]?.title || 'Nordsweet'};}
export default async function ToolPage({params}){
  const {tool:requestedTool}=await params;
  const tool=requestedTool.replace(/\.html$/,'');
  if(!pages[tool] || tool==='index')notFound();
  const View=views[tool];
  return <><View/><RuntimeBootstrap page={tool} bodyClass={pages[tool].bodyClass} bodyStyle={pages[tool].bodyStyle}/></>;
}
