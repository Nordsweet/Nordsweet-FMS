import { z } from "zod";

export const popupCategorySchema = z.enum([
  "heading",
  "altitude",
  "comms",
  "frequency",
  "system",
]);
export type PopupCategory = z.infer<typeof popupCategorySchema>;
export const flightNotificationSchema = z.object({
  id: z.string(),
  category: popupCategorySchema,
  message: z.string(),
  createdAt: z.number().finite().nonnegative().max(8.64e15),
});
export type FlightNotification = z.infer<typeof flightNotificationSchema>;
