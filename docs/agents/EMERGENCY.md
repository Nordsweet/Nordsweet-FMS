# EMER and Engine Out

Requested specification: [Future Features emergency section](FUTURE_FEATURES_REFERENCE.md).
The owner assigned the supplied Reims Rocket screenshots to **FR172H** on 2026-10-18.

## Source and release status

- Canonical typed definitions: `nextjs/src/data/emergency.ts`. All **22** source actions
  are retained in the original English, together with the warning, conditional restart note,
  securing branch and unpaved-surface note. Source images are managed in
  `docs/aircraft/FR172H/engine-failure-reference-{1,2}.png`.
- The first image has no visible page/edition. The continuation is Reims Rocket,
  Reims Aviation, page 3-2, edition 2. Full manual applicability, serial range,
  equipment, registration and airspeed basis remain unverified.
- These definitions therefore remain **reference**, available only by explicit source-reference
  browsing. Assigning a model does not assert that the source is reviewed operating guidance.
  Reference speed values are not published as best-glide profile data.
- No Engine Fire, Electric, Hydraulic, Pax or Fuel operating steps were supplied. Their UI
  distinguishes missing procedure/equipment documentation; no substitute instructions are generated.
- Aircraft profiles can supply `emergencyProcedures`, validated by Zod. Operational publication
  requires status `verified`, reviewer/date, edition, serial range and equipment, matching exact
  aircraft type and any registration restriction. Qualified review and the complete applicable
  AFM/POH remain release dependencies for live procedure content.

## Behaviour

- EMER shortcuts and categories are available in Fly and after the normal checklist library.
  Both views use one persisted session, revision snapshot and stable action IDs. Phase variants
  preserve independent check states; switching families archives the old session. Ending requires
  explicit confirmation. Completion never resolves an emergency or implies engine restart.
- Sessions are scoped to planned flight ID, aircraft profile and in-flight start time. Other
  flights/profiles cannot reuse progress. Closing a panel preserves the session and target.
  Definitions are bundled in the offline application; opening content does not require a request.
- Manual phase selection remains visible. Sufficient runway ahead requires pilot confirmation.
  Fresh GPS plus an active Air Time timer and airborne phase establish airborne context;
  climb does not imply a generic after-takeoff altitude boundary. The procedure phase is frozen
  until explicitly changed. No checklist is inferred from descent alone.
- **Engine Out**, when reliably airborne, requests the separate map route immediately.
  General EMER/Engine category, Fire, checklist ticks and ordinary descent do not reroute.
  The original flight plan is retained. The target stays fixed until explicit recalculation,
  runway selection, family change or session ending. Position changes update approach geometry.
- Thresholds and true source runway headings determine a full 0.5 NM final. The existing rate-one
  connector is solved in reverse so the capture turn ends at the start of final, not beyond it.
  The shorter feasible connector is selected without wind. Already established inside final
  continues toward the threshold. No missing threshold is replaced by the ARP.
- Nearest means nearest landing threshold, then shortest feasible approach at that airport, with
  deterministic airport/runway tie-breaking. Legacy airport data has no structured current closure
  field. Any closure/inactivity mention in its notes conservatively excludes the entire airport
  (possibly including an open parallel runway), pending structured availability data. Remaining
  runway suitability is explicitly **unconfirmed**, not a declaration that the runway is open.
- Phase/reference restrictions produce a dashed, unvalidated preview; after-takeoff source warnings
  remain present. The emergency overlay is separate from ordinary FPL navigation: it does not
  manipulate aircraft controls or replace stored route/holding/pattern state.
- Terrain/wind-aware reach supersedes the original horizontal current-trend circle. Inputs,
  DEM/geoid sources, freshness, no-data rules, model limitations, caching and verification are
  specified in [Terrain and glide reach](TERRAIN_GLIDE_REACH.md). Green airports require their full
  displayed approach to pass DEM/wind checks. Unvalidated approaches remain previews. Browser
  ellipsoidal height is only usable after the documented coarse EGM96 correction and trend/accuracy
  checks; current instrument AMSL/V/S entry remains available and takes priority for 20 seconds.
- Routine COMMs/FREDA and holding/pattern report popups are suppressed while the matching emergency
  session is active. Map, target and range status remain accessible when the panel is closed.

## Validation

Domain tests cover range/age/datum/zero cases, true threshold geometry, several approach directions,
complete final, established final, threshold-vs-ARP selection, phase evidence, source distinctions,
shared revision snapshots, family history and stable targets. Browser tests cover shared progress,
reload, reference separation, no Fire fallback, automatic route trigger, retained FPL, explicit end,
runway-sufficiency confirmation and twin-aircraft exclusion.
