import { type Metadata } from "next";
import { notFound } from "next/navigation";

import RuntimeBootstrap from "~/components/RuntimeBootstrap";
import { isPageId, pages } from "~/pages";
import { views } from "~/views/registry";

type Params = Promise<{ tool: string }>;

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(pages)
    .filter((tool) => tool !== "index")
    .map((tool) => ({ tool }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const tool = (await params).tool.replace(/\.html$/, "");
  return { title: isPageId(tool) ? pages[tool].title : "Nordsweet" };
}

export default async function ToolPage({ params }: { params: Params }) {
  const tool = (await params).tool.replace(/\.html$/, "");
  if (!isPageId(tool) || tool === "index") notFound();
  const View = views[tool];
  const { bodyClass, bodyStyle } = pages[tool];
  return (
    <>
      <View />
      <RuntimeBootstrap page={tool} bodyClass={bodyClass} bodyStyle={bodyStyle} />
    </>
  );
}
