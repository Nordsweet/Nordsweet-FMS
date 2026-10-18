import { z } from "zod";

const reading = z.number().finite().nonnegative().nullable();
export const debriefSchema = z.object({
  flightId: z.string(),
  name: z.string(),
  aircraftType: z.string().nullable(),
  registration: z.string(),
  mthBefore: reading,
  fuelBeforeL: reading,
  endedAt: reading,
  times: z.object({
    offBlockAt: reading,
    onBlockAt: reading,
    takeoffAt: reading,
    landingAt: reading,
  }),
  accepted: z
    .object({
      mthAfter: z.number().finite().min(0).max(99999.99),
      fuelAfterL: z.number().finite().nonnegative(),
      at: z.number().finite().nonnegative(),
    })
    .nullable(),
});
export type Debrief = z.infer<typeof debriefSchema>;
