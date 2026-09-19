export type AreaCluster =
  | "hills"
  | "south"
  | "inner_south"
  | "east"
  | "north"
  | "west"
  | "cbd"
  | "unknown";

const SUBURB_CLUSTER: Record<string, AreaCluster> = {
  crafers: "hills",
  stirling: "hills",
  aldgate: "hills",
  bridgewater: "hills",
  piccadilly: "hills",
  belair: "hills",
  blackwood: "hills",
  craferswest: "hills",
  glenelg: "south",
  "glenelgnorth": "south",
  "glenelgsouth": "south",
  "somertonpark": "south",
  brighton: "south",
  seacliff: "south",
  marino: "south",
  "hallettcove": "south",
  marion: "south",
  oaklands: "south",
  unley: "inner_south",
  goodwood: "inner_south",
  parkside: "inner_south",
  "hydepark": "inner_south",
  malvern: "inner_south",
  wayville: "inner_south",
  millswood: "inner_south",
  norwood: "east",
  kensington: "east",
  magill: "east",
  payneham: "east",
  stepney: "east",
  burnside: "east",
  toorakgardens: "east",
  prospect: "north",
  "northadelaide": "north",
  nailsworth: "north",
  enfield: "north",
  walkerville: "north",
  hindmarsh: "west",
  thebarton: "west",
  torrensville: "west",
  "mileend": "west",
  richmond: "west",
  adelaide: "cbd",
};

const ADJACENT: Record<AreaCluster, AreaCluster[]> = {
  hills: ["east", "inner_south", "south"],
  south: ["inner_south", "west", "hills"],
  inner_south: ["south", "east", "cbd", "hills", "west"],
  east: ["hills", "inner_south", "cbd", "north"],
  north: ["cbd", "east", "west"],
  west: ["cbd", "south", "inner_south", "north"],
  cbd: ["north", "east", "west", "inner_south"],
  unknown: [],
};

function keySuburb(suburb?: string | null) {
  return (suburb ?? "")
    .toLowerCase()
    .replace(/sa\s*\d+/, "")
    .replace(/[^a-z]/g, "");
}

export function suburbCluster(suburb?: string | null): AreaCluster {
  const key = keySuburb(suburb);
  if (!key) return "unknown";
  return SUBURB_CLUSTER[key] ?? "unknown";
}

export function clustersAreAdjacent(a: AreaCluster, b: AreaCluster) {
  if (a === "unknown" || b === "unknown") return false;
  return ADJACENT[a].includes(b);
}

export function sameSuburb(a?: string | null, b?: string | null) {
  const left = keySuburb(a);
  const right = keySuburb(b);
  return Boolean(left && left === right);
}
