export const FT_PER_M = 1 / 0.3048;
export const M_PER_NM = 1852;
export const KG_PER_LB = 0.45359237;
export const L_PER_US_GAL = 3.785411784;
export const HPA_PER_INHG = 33.8638866667;

export const ftToM = (ft: number) => ft * 0.3048;
export const mToFt = (m: number) => m * FT_PER_M;
export const nmToM = (nm: number) => nm * M_PER_NM;
export const mToNm = (m: number) => m / M_PER_NM;
export const kgToLb = (kg: number) => kg / KG_PER_LB;
export const lbToKg = (lb: number) => lb * KG_PER_LB;
export const usGalToL = (gal: number) => gal * L_PER_US_GAL;
export const lToUsGal = (l: number) => l / L_PER_US_GAL;
export const inHgToHpa = (inHg: number) => inHg * HPA_PER_INHG;
export const hpaToInHg = (hpa: number) => hpa / HPA_PER_INHG;
export const ktToMps = (kt: number) => (kt * M_PER_NM) / 3600;
export const mpsToKt = (mps: number) => (mps * 3600) / M_PER_NM;
