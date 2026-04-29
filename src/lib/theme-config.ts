export interface ThemeColorSet {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  inversePrimary: string;
  primaryFixed: string;
  primaryFixedDim: string;
  onPrimaryFixed: string;
  onPrimaryFixedVariant: string;
  surfaceTint: string;
  [key: string]: string;
}

export const themeColorSchemes: Record<string, ThemeColorSet> = {
  emerald: {
    primary: "#57f1db",
    onPrimary: "#003731",
    primaryContainer: "#2dd4bf",
    onPrimaryContainer: "#00574d",
    inversePrimary: "#006b5f",
    primaryFixed: "#62fae3",
    primaryFixedDim: "#3cddc7",
    onPrimaryFixed: "#00201c",
    onPrimaryFixedVariant: "#005047",
    surfaceTint: "#3cddc7",
  },
  terracotta: {
    primary: "#ffb4a2",
    onPrimary: "#5e1d0a",
    primaryContainer: "#ff866b",
    onPrimaryContainer: "#8f3000",
    inversePrimary: "#a84024",
    primaryFixed: "#ffc1b1",
    primaryFixedDim: "#ff9a82",
    onPrimaryFixed: "#3a0a00",
    onPrimaryFixedVariant: "#782500",
    surfaceTint: "#ff9a82",
  },
  sky: {
    primary: "#8cd4ff",
    onPrimary: "#00344d",
    primaryContainer: "#5db9f0",
    onPrimaryContainer: "#005077",
    inversePrimary: "#0077b3",
    primaryFixed: "#9ddcff",
    primaryFixedDim: "#72c5f7",
    onPrimaryFixed: "#001e2e",
    onPrimaryFixedVariant: "#004668",
    surfaceTint: "#72c5f7",
  },
  lavender: {
    primary: "#d6b8ff",
    onPrimary: "#3b1d6e",
    primaryContainer: "#b78af0",
    onPrimaryContainer: "#5a2d9e",
    inversePrimary: "#7d4fbb",
    primaryFixed: "#e0c8ff",
    primaryFixedDim: "#c6a3f5",
    onPrimaryFixed: "#240a52",
    onPrimaryFixedVariant: "#4d218a",
    surfaceTint: "#c6a3f5",
  },
  rose: {
    primary: "#ffb4c2",
    onPrimary: "#5e1132",
    primaryContainer: "#ff7d9e",
    onPrimaryContainer: "#8f2050",
    inversePrimary: "#a84168",
    primaryFixed: "#ffc4d0",
    primaryFixedDim: "#ff97b0",
    onPrimaryFixed: "#3a001c",
    onPrimaryFixedVariant: "#780742",
    surfaceTint: "#ff97b0",
  },
};

export type ThemeMode = "dark" | "light" | "system";
export type ThemeColor = keyof typeof themeColorSchemes;

export const themeColorLabels: Record<ThemeColor, string> = {
  emerald: "Botanical Teal",
  terracotta: "Terracotta Amber",
  sky: "Sky Blue",
  lavender: "Lavender",
  rose: "Rose",
};
