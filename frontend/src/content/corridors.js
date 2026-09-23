// Hand-drawn routes for the animated "Traffic flow" layer. Coordinates are approximate road alignments
// [lon, lat], listed in the direction the story describes traffic moving: INTO the zone for the two tunnels
// that feed it, AROUND Manhattan for the bridges that bypass it. Entry stubs point at each zone gate from the
// side traffic arrives. The dash animation travels from the first coordinate to the last.

export const CROSSING_ROUTES = {
  // into the zone
  hlc: [[-73.998, 40.665], [-74.008, 40.682], [-74.015, 40.698], [-74.014, 40.708]],
  qmt: [[-73.925, 40.742], [-73.945, 40.7435], [-73.9635, 40.7438], [-73.978, 40.746]],
  // around Manhattan: Harlem / the Bronx -> Randalls Island -> Queens
  rfk_manhattan: [[-73.952, 40.812], [-73.9305, 40.7975], [-73.921, 40.789], [-73.916, 40.775], [-73.921, 40.758]],
  rfk_bronx: [[-73.912, 40.826], [-73.9215, 40.8005], [-73.921, 40.789], [-73.916, 40.775], [-73.921, 40.758]],
  // the Bronx -> Queens bypasses
  whitestone: [[-73.836, 40.852], [-73.8292, 40.8012], [-73.826, 40.775], [-73.815, 40.752]],
  throgs_neck: [[-73.815, 40.83], [-73.793, 40.8005], [-73.788, 40.778], [-73.786, 40.752]],
  // Riverdale -> Inwood -> down the west side
  henry_hudson: [[-73.905, 40.905], [-73.9221, 40.8774], [-73.931, 40.858], [-73.946, 40.836]],
  // Staten Island -> Brooklyn (Gowanus / BQE)
  verrazzano: [[-74.09, 40.59], [-74.0447, 40.6066], [-74.022, 40.62], [-74.01, 40.648]],
  // the Rockaways (far from the zone)
  marine_parkway: [[-73.872, 40.556], [-73.885, 40.5735], [-73.894, 40.596], [-73.9, 40.618]],
  cross_bay: [[-73.821, 40.573], [-73.8205, 40.5935], [-73.828, 40.616], [-73.84, 40.645]],
};

/** Where traffic arrives from, per zone entry point (the stub runs from here to the gate). */
export const ENTRY_FROM = {
  brooklyn_bridge: [-73.992, 40.699],
  manhattan_bridge: [-73.982, 40.703],
  williamsburg_bridge: [-73.968, 40.711],
  hugh_carey_tunnel: [-74.011, 40.683],
  holland_tunnel: [-74.032, 40.727],
  lincoln_tunnel: [-74.022, 40.765],
  queens_midtown_tunnel: [-73.949, 40.745],
  queensboro_bridge: [-73.944, 40.752],
  east_60th: [-73.957, 40.775],
  fdr_60th: [-73.951, 40.772],
  west_60th: [-73.976, 40.783],
  wsh_60th: [-73.986, 40.786],
};

export function entryStub(id, gate) {
  const from = ENTRY_FROM[id];
  return from && Array.isArray(gate) ? [from, gate] : null;
}

// Hand-drawn routes linking outer-borough AQ monitors (well outside the zone) to the CRZ gate their
// traffic would realistically funnel through, following the highway corridor between them. Used to draw
// the same animated flow lines as CROSSING_ROUTES so a reader can visually trace how a distant reading
// connects back to the congestion zone.
export const AQ_LINK_ROUTES = {
  aq_36081NY08198: [[-73.8863, 40.7057], [-73.912, 40.708], [-73.94, 40.711], [-73.968, 40.713], [-73.985, 40.7175]], // Glendale -> BQE -> Williamsburg Bridge
  aq_36081NY09285: [[-73.8216, 40.7371], [-73.87, 40.7425], [-73.92, 40.745], [-73.9505, 40.745], [-73.9715, 40.7455]], // Queens College -> LIE -> Queens Midtown Tunnel
  aq_36081NY07615: [[-73.8091, 40.6902], [-73.83, 40.716], [-73.86, 40.735], [-73.92, 40.744], [-73.9505, 40.745], [-73.9715, 40.7455]], // Van Wyck -> Van Wyck Expwy/LIE -> Queens Midtown Tunnel
  aq_36005NY11534: [[-73.9225, 40.8065], [-73.921, 40.789], [-73.916, 40.775], [-73.921, 40.758], [-73.966, 40.7628]], // Mott Haven -> RFK/FDR -> 60th St (east)
  aq_36005NY11790: [[-73.8857, 40.8191], [-73.905, 40.8085], [-73.921, 40.789], [-73.916, 40.775], [-73.9592, 40.7592]], // Hunts Point -> Bruckner/FDR -> 60th St (FDR)
  aq_36061NY12380: [[-73.933, 40.8465], [-73.94, 40.833], [-73.95, 40.8], [-73.97, 40.783], [-73.9855, 40.771]], // Hamilton Bridge -> Henry Hudson -> 60th St (west)
  aq_36005NY12387: [[-73.9061, 40.8452], [-73.92, 40.81], [-73.921, 40.789], [-73.916, 40.775], [-73.966, 40.7628]], // Cross Bronx Expwy -> RFK/FDR -> 60th St (east)
  aq_36085NY04805: [[-74.1459, 40.6279], [-74.09, 40.5985], [-74.0447, 40.6066], [-74.022, 40.62], [-74.012, 40.66], [-74.0138, 40.7028]], // Port Richmond -> Verrazzano/BQE -> Hugh Carey Tunnel
  aq_36085NY03820: [[-74.1512, 40.6092], [-74.1, 40.6], [-74.0447, 40.6066], [-74.022, 40.62], [-74.012, 40.66], [-74.0138, 40.7028]], // SI Expwy -> Verrazzano/BQE -> Hugh Carey Tunnel
};
