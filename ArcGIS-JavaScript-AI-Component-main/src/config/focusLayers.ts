/** Map layers whose intersection with the selected polygon becomes RAG filters, and the field that carries each layer's code. */

const SERVICES = "https://services.arcgis.com/b6zSqPB0TQc3mBgU/arcgis/rest/services";

export interface FocusLayer {
  id: string;
  /** Hebrew name shown on the selection chips. */
  label: string;
  serviceUrl: string;
  layerId: number;
  codeField: string;
  /** Field shown on the chips instead of the code. */
  labelField?: string;
  /** areas / entities: the code is the filter value; gis_code: it is looked up in the RAG's `gis_codes` of `gisLayer`. */
  target: "areas" | "entities" | "gis_code";
  gisLayer?: "zones" | "foci";
}

export const FOCUS_LAYERS: FocusLayer[] = [
  {
    id: "zones", label: "אזורי ייעוד", serviceUrl: `${SERVICES}/TA5500_פוליגונים1/FeatureServer`, layerId: 128,
    codeField: "EzorYeudCode", labelField: "EzorYeud", target: "gis_code", gisLayer: "zones",
  },
  {
    id: "planning-areas", label: "אזורי תכנון", serviceUrl: `${SERVICES}/TA5500_פוליגונים1/FeatureServer`, layerId: 122,
    codeField: "NumEzorTihnun", target: "areas",
  },
  {
    id: "foci", label: "מוקדי פיתוח ושימוש עירוניים", serviceUrl: `${SERVICES}/TA5500_נק/FeatureServer`, layerId: 124,
    codeField: "TypeCode", labelField: "TypeName", target: "gis_code", gisLayer: "foci",
  },
  {
    id: "planning-spaces", label: "מרחבי תכנון", serviceUrl: `${SERVICES}/TA5500_פוליגונים2/FeatureServer`, layerId: 145,
    codeField: "mis_ezor", labelField: "shem_ezor", target: "areas",
  },
  {
    id: "special-streets", label: "הוראות רחוב מיוחדות", serviceUrl: `${SERVICES}/TA5500_קווים/FeatureServer`, layerId: 146,
    codeField: "mis_ezor", labelField: "shem_ezor", target: "entities",
  },
];

/** The most values sent per search filter, largest overlap first; a polygon over a whole district would otherwise list everything. */
export const FOCUS_LIMITS = { areas: 10, zone_types: 8, entities: 8, headings: 4 } as const;

/** Features that overlap the polygon by less than this share are slivers and are ignored. */
export const MIN_OVERLAP_SHARE = 0.02;
