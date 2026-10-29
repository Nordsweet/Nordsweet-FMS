import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "~/api";
import { browserCharts } from "~/domain/chart-browser";

/** Airport details and the FPL viewer use the same document IDs and source priority. */
export function useBrowserCharts(enabled = true) {
  const catalog = useQuery({
    ...api.charts.catalog.queryOptions(undefined),
    enabled,
  });
  const library = useQuery({
    ...api.charts.library.queryOptions(undefined),
    enabled,
  });
  const procedures = useQuery({
    ...api.procedures.all.queryOptions(undefined),
    enabled,
  });
  const bundled = useQuery({
    ...api.charts.all.queryOptions(undefined),
    enabled,
  });
  const charts = useMemo(
    () =>
      browserCharts(
        catalog.data,
        library.data,
        bundled.data ?? [],
        procedures.data ?? [],
      ),
    [catalog.data, library.data, bundled.data, procedures.data],
  );
  return { charts, catalog };
}
