import { beforeEach, expect, it } from "vitest";
import { useFuelReserveNotice } from "./fuel-reserve-notice";

beforeEach(() =>
  useFuelReserveNotice.setState({
    session: null,
    level: null,
    at: 0,
    dismissed: false,
  }),
);

it("keeps acknowledgement and original time across repeated samples, escalating to final", () => {
  const monitor = useFuelReserveNotice.getState();
  monitor.observe("flight-1", "alternate", 1000);
  monitor.dismiss();
  monitor.observe("flight-1", "alternate", 2000);
  expect(useFuelReserveNotice.getState()).toMatchObject({
    dismissed: true,
    at: 1000,
  });
  monitor.observe("flight-1", "final", 3000);
  expect(useFuelReserveNotice.getState()).toMatchObject({
    level: "final",
    dismissed: false,
    at: 3000,
  });
});

it("rearms after a corrected safe reading and for a new flight", () => {
  const monitor = useFuelReserveNotice.getState();
  monitor.observe("flight-1", "final", 1000);
  monitor.dismiss();
  monitor.observe("flight-1", null, 2000);
  monitor.observe("flight-1", "final", 3000);
  expect(useFuelReserveNotice.getState()).toMatchObject({
    dismissed: false,
    at: 3000,
  });
  monitor.dismiss();
  monitor.observe("flight-2", "final", 4000);
  expect(useFuelReserveNotice.getState()).toMatchObject({
    session: "flight-2",
    dismissed: false,
    at: 4000,
  });
});
