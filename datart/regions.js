export const DEFAULT_REGIONS = ["CZ"];

export const REGION_SETTINGS = [
  {
    key: "allowedRegions",
    label: "Regions",
    type: "text",
    default: DEFAULT_REGIONS.join(","),
    placeholder: DEFAULT_REGIONS.join(","),
    description:
      "Comma-separated region codes this engine runs for (e.g. CZ or CZ,SK). Searches in other regions skip it. Leave blank to run everywhere.",
  },
  {
    key: "runWithoutRegion",
    label: "Run when no region is set",
    type: "toggle",
    default: "true",
    description: "Whether to search when the region is not chosen.",
  },
];

export const parseRegions = (raw) =>
  String(raw ?? "")
    .split(",")
    .map((r) => r.trim().toUpperCase())
    .filter((r) => /^[A-Z]{2}$/.test(r));

export const regionAllowed = (region, allowed, runWithoutRegion) => {
  if (allowed.length === 0) return true;
  const current = String(region ?? "").trim().toUpperCase();
  if (!current) return runWithoutRegion;
  return allowed.includes(current);
};
