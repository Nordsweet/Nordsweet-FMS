import type { Page } from "@playwright/test";

/**
 * The flight in progress is written to localStorage at most every 2 s: wait before reading it back.
 * A test that installed `page.clock` has to move that clock, because the wait is a page timer.
 */
export const settleStorage = (page: Page, { clock = false } = {}) =>
  clock ? page.clock.fastForward(2100) : page.waitForTimeout(2100);
