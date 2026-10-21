import { z } from "zod";

export const airrepSchema = z.object({
  id: z.string().min(1).max(200),
  flight_started_at: z.string().datetime(),
  waypoint: z.string().min(1).max(64),
  passed_at: z.string().datetime(),
  observed_at: z.string().datetime(),
  source: z.enum(["gps", "simulator"]),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  altitude_ft: z.number().min(-2000).max(65000),
  wind_from_deg: z.number().min(0).lt(360).nullable(),
  wind_speed_kt: z.number().min(0).max(300),
  residual_kt: z.number().min(0).max(100),
});
export type Airrep = z.infer<typeof airrepSchema>;
