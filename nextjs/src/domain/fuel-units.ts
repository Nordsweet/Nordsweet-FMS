export type FuelUnit = "L" | "US gal";
export const LITRES_PER_US_GALLON = 3.785411784;

/** Presentation only: all performance, loading and persisted fuel quantities remain litres. */
export const fuelUnit = (
  type?: string | null,
  selected?: FuelUnit | null,
): FuelUnit => selected ?? (type === "C172S" ? "US gal" : "L");
export const fuelFromLitres = (litres: number, unit: FuelUnit) =>
  unit === "L" ? litres : litres / LITRES_PER_US_GALLON;
export const fuelToLitres = (value: number, unit: FuelUnit) =>
  unit === "L" ? value : value * LITRES_PER_US_GALLON;
export const formatFuel = (litres: number, unit: FuelUnit) =>
  String(Math.round(fuelFromLitres(litres, unit)));
export const parseFuel = (text: string, unit: FuelUnit) => {
  if (!text.trim()) return null;
  const value = Number(text.replace(",", "."));
  return Number.isFinite(value) && value >= 0
    ? fuelToLitres(value, unit)
    : null;
};
