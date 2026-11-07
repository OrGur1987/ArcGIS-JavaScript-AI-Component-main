/** Map layers whose intersection with the selected polygon becomes RAG filters, and the field that carries each layer's code. */

const SERVICES = "https://services.arcgis.com/b6zSqPB0TQc3mBgU/arcgis/rest/services";

export interface FocusLayer {
  id: string;
  /** Hebrew name shown on the selection chips. */
  label: string;
  serviceUrl: string;
  layerId: number;
  geometry: "polygon" | "polyline" | "point";
  codeField: string;
  /** Field shown on the chips instead of the code. */
  labelField?: string;
  /** areas / entities: the code is the filter value; gis_code: it is looked up in the RAG's `gis_codes` of `gisLayer`; note: it becomes a `focus_notes` entry. */
  target: "areas" | "entities" | "gis_code" | "note";
  /** Notes only: 1 = served first by the RAG. */
  priority?: 1 | 2 | 3;
  gisLayer?: "zones" | "foci" | "employment";
}

export const FOCUS_LAYERS: FocusLayer[] = [
  {
    id: "zones", label: "אזורי ייעוד", serviceUrl: `${SERVICES}/TA5500_פוליגונים1/FeatureServer`, layerId: 128, geometry: "polygon",
    codeField: "EzorYeudCode", labelField: "EzorYeud", target: "gis_code", gisLayer: "zones",
  },
  {
    id: "planning-areas", label: "אזורי תכנון", serviceUrl: `${SERVICES}/TA5500_פוליגונים1/FeatureServer`, layerId: 122, geometry: "polygon",
    codeField: "NumEzorTihnun", target: "areas",
  },
  {
    id: "foci", label: "מוקדי פיתוח ושימוש עירוניים", serviceUrl: `${SERVICES}/TA5500_נק/FeatureServer`, layerId: 124, geometry: "point",
    codeField: "TypeCode", labelField: "TypeName", target: "gis_code", gisLayer: "foci",
  },
  {
    id: "planning-spaces", label: "מרחבי תכנון", serviceUrl: `${SERVICES}/TA5500_פוליגונים2/FeatureServer`, layerId: 145, geometry: "polygon",
    codeField: "mis_ezor", labelField: "shem_ezor", target: "areas",
  },
  {
    id: "special-streets", label: "הוראות רחוב מיוחדות", serviceUrl: `${SERVICES}/TA5500_קווים/FeatureServer`, layerId: 146, geometry: "polyline",
    codeField: "mis_ezor", labelField: "shem_ezor", target: "entities",
  },
  {
    id: "employment", label: "ייעודי תעסוקה וקירוי", serviceUrl: `${SERVICES}/TA5500_פוליגונים2/FeatureServer`, layerId: 126, geometry: "polygon",
    codeField: "TypeCode", labelField: "TypeName", target: "gis_code", gisLayer: "employment",
  },
  // layers below reach the RAG as notes; ids are the keys of `focus_codes` in the RAG's models.yml
  {
    id: "axes", label: "צירי תכנון וקווי תיחום", serviceUrl: `${SERVICES}/TA5500_קווים/FeatureServer`, layerId: 125, geometry: "polyline",
    codeField: "TypeCode2", labelField: "TypeName2", target: "note", priority: 1,
  },
  {
    id: "transport-areas", label: "פוליגונים תחבורה", serviceUrl: `${SERVICES}/TA5500_פוליגונים1/FeatureServer`, layerId: 165, geometry: "polygon",
    codeField: "TypeCode", labelField: "TypeName", target: "note", priority: 2,
  },
  {
    id: "transport-lines", label: "רשת תחבורה מטרופולינית", serviceUrl: `${SERVICES}/TA5500_קווים/FeatureServer`, layerId: 164, geometry: "polyline",
    codeField: "TypeCode2", labelField: "TypeName2", target: "note", priority: 2,
  },
  {
    id: "transport-points", label: "מוקדי תחבורה", serviceUrl: `${SERVICES}/TA5500_נק/FeatureServer`, layerId: 163, geometry: "point",
    codeField: "TypeCode2", labelField: "TypeName2", target: "note", priority: 2,
  },
  {
    id: "urban-infra-areas", label: "פוליגוני תשתיות עירוניות", serviceUrl: `${SERVICES}/פוליגונים4_TA5500/FeatureServer`, layerId: 157, geometry: "polygon",
    codeField: "TypeCode2", labelField: "TypeName2", target: "note", priority: 2,
  },
  {
    id: "infra-lines", label: "קווי תשתית", serviceUrl: `${SERVICES}/TA5500_קווים/FeatureServer`, layerId: 156, geometry: "polyline",
    codeField: "TypeCode2", labelField: "TypeName2", target: "note", priority: 2,
  },
  {
    id: "infra-points", label: "נקודות תשתית חמשל מים וביוב", serviceUrl: `${SERVICES}/TA5500_נק/FeatureServer`, layerId: 155, geometry: "point",
    codeField: "TypeCode2", labelField: "TypeName2", target: "note", priority: 3,
  },
  {
    // no code field: the zone name is the code the RAG resolves
    id: "marine-engineering", label: "מתקנים הנדסיים ימיים ונחלים", serviceUrl: `${SERVICES}/TA5500_פוליגונים1/FeatureServer`, layerId: 159, geometry: "polygon",
    codeField: "EzorYeud", target: "note", priority: 3,
  },
];

/** The most notes sent per layer and in total (the RAG accepts at most 50). */
export const FOCUS_NOTE_LIMITS = { perLayer: 6, total: 40 } as const;

/** The most values sent per search filter, largest overlap first; a polygon over a whole district would otherwise list everything. */
export const FOCUS_LIMITS = { areas: 10, zone_types: 8, entities: 8, headings: 4 } as const;

/** Features that overlap the polygon by less than this share are slivers and are ignored. */
export const MIN_OVERLAP_SHARE = 0.02;
