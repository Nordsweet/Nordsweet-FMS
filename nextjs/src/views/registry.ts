import { type ComponentType } from "react";

import { type PageId } from "~/pages";
import AirportFrequenciesEditor from "./airport-frequencies-editor";
import AirspacesEditor from "./airspaces-editor";
import AirspacesMap from "./airspaces-map";
import Airspaces from "./airspaces";
import ChartBrowser from "./chart-browser";
import ChecklistEditor from "./checklist-editor";
import GroundEditor from "./ground-editor";
import Index from "./index";
import PFD from "./PFD";
import Traffic from "./traffic";
import WaypointProcedureEditor from "./waypoint-procedure-editor";

export const views: Record<PageId, ComponentType> = {
  "airport-frequencies-editor": AirportFrequenciesEditor,
  "airspaces-editor": AirspacesEditor,
  "airspaces-map": AirspacesMap,
  airspaces: Airspaces,
  "chart-browser": ChartBrowser,
  "checklist-editor": ChecklistEditor,
  "ground-editor": GroundEditor,
  index: Index,
  PFD,
  traffic: Traffic,
  "waypoint-procedure-editor": WaypointProcedureEditor,
};
