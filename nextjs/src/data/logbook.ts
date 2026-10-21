import { z } from "zod";

const instant = z.number().finite().nonnegative().nullable();
export const logbookEntrySchema = z.object({
  id: z.string().min(1).max(100),
  startedAt: z.iso.datetime(),
  endedAt: instant,
  aircraftType: z.string().max(100),
  registration: z.string().max(32),
  departure: z.string().max(100),
  arrival: z.string().max(100),
  pic: z.string().trim().min(1).max(120),
  offBlockAt: instant,
  takeoffAt: instant,
  landingAt: instant,
  landingCount: z.number().int().nonnegative().optional(),
  onBlockAt: instant,
  mthBefore: instant,
  mthAfter: instant,
  fuelBeforeL: instant,
  fuelAfterL: instant,
});
export type LogbookEntry = z.infer<typeof logbookEntrySchema>;
