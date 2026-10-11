import pageData from "./pages.json";

export type PageId = keyof typeof pageData;
export type PageConfig = { title: string; bodyClass: string; bodyStyle: string };

export const pages: Record<PageId, PageConfig> = pageData;

export function isPageId(id: string): id is PageId {
  return Object.hasOwn(pages, id);
}
