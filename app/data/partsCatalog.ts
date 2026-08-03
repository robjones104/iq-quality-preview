import { PART_CATALOG } from './filterOptions';

export type CatalogPart = { partNumber: string; partDescription: string };

// Contextual parts eligibility for the intake form (INTAKE-SPEC.md): the part
// picker narrows to what fits the reported door + component instead of
// offering the whole catalog. Prototype-sized mapping over the existing
// PART_CATALOG; free-text entry remains the fallback path in the form.

// Component → part numbers from PART_CATALOG that plausibly serve it.
const COMPONENT_PARTS: Record<string, string[]> = {
  'Motor Gearbox':         ['413856-1', '413857-2', '413858-3', '413859-1'],
  'Hardware Kit':          ['413856-2', '418220-1', '418221-1', '418222-1', '418222-2', '430114-1', '430114-2', '430115-1'],
  'Controller':            ['421033-1', '421033-2', '421033-3', '421033-4', '421034-1', '421035-1', '421035-2'],
  'Sensors':               ['425901-1', '425902-1'],
  'Threshold':             ['413856-3', '435670-1', '435670-2', '435671-1'],
  'Glass':                 ['440221-1', '440222-1', '440222-2'],
  'Transom':               ['440221-1', '440222-2'],
  'Jamb':                  ['444512-1'],
  'Header':                ['437110-1', '437110-2', '447801-1', '447801-2'],
  'Panel':                 ['450901-1', '440221-1'],
  'Complete Door Package': ['437110-1', '437110-2', '450901-1', '440221-1', '413856-2'],
};

// Door option → the family token its parts carry in their descriptions.
// Parts with no family token are generic and fit every door.
const DOOR_TOKENS: Record<string, string> = {
  'Dura_Glide Greenstar 2000': 'GREENSTAR',
  'Dura_Glide Greenstar 3000': 'GREENSTAR',
  'Dura_Glide 5200':           'DURA-GLIDE 5200',
  'Dura_Glide 2000 Series':    'DURA-GLIDE 2000',
  'IS 10000':                  'IS 10000',
  'Magic Access':              'MAGIC ACCESS',
  'All Glass 2000':            'ALL GLASS 2000',
  'Dura_Storm':                'DURA-STORM',
  'Duraguard 3000':            'DURAGUARD 3000',
  'M-Force Swing Door':        'M-SERIES',
};

const ALL_TOKENS = [...new Set(Object.values(DOOR_TOKENS))];

function fitsDoor(part: CatalogPart, door: string): boolean {
  const desc = part.partDescription.toUpperCase();
  const carried = ALL_TOKENS.filter(t => desc.includes(t));
  if (carried.length === 0) return true; // generic part
  const token = DOOR_TOKENS[door];
  return token ? carried.includes(token) : true;
}

/** Catalog parts eligible for the given door + component. Falls back to the
 *  full catalog when the component is unmapped or the narrowing empties out,
 *  so the picker is never a dead end. */
export function eligibleParts(door?: string, component?: string): CatalogPart[] {
  const byComponent = component && COMPONENT_PARTS[component]
    ? PART_CATALOG.filter(p => COMPONENT_PARTS[component].includes(p.partNumber))
    : PART_CATALOG;
  const narrowed = door ? byComponent.filter(p => fitsDoor(p, door)) : byComponent;
  return narrowed.length ? narrowed : PART_CATALOG;
}
