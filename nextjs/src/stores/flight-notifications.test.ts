import { beforeEach, expect, it } from "vitest";
import { useFlightNotificationHistory } from "./flight-notifications";
import { popupCategorySchema } from "~/data/flight-notification";

beforeEach(() =>
  useFlightNotificationHistory.setState({
    session: null,
    entries: [],
    readCount: 0,
  }),
);

it("records all popup categories once, retaining the original timestamp and text across remounts", () => {
  const history = useFlightNotificationHistory.getState();
  for (const category of popupCategorySchema.options) {
    history.record("flight-1", {
      id: category,
      category,
      message: `${category} original`,
      createdAt: 1000,
    });
    history.record("flight-1", {
      id: category,
      category,
      message: "rerender",
      createdAt: 2000,
    });
  }
  expect(useFlightNotificationHistory.getState().entries).toHaveLength(5);
  expect(
    useFlightNotificationHistory
      .getState()
      .entries.every(
        (e) => e.createdAt === 1000 && e.message.endsWith("original"),
      ),
  ).toBe(true);
  history.begin("flight-1");
  history.markRead();
  expect(useFlightNotificationHistory.getState().readCount).toBe(5);
  history.record("flight-1", {
    id: "new",
    category: "comms",
    message: "Report Base",
    createdAt: 3000,
  });
  expect(
    useFlightNotificationHistory.getState().entries.length -
      useFlightNotificationHistory.getState().readCount,
  ).toBe(1);
});

it("retains the completed flight until another starts and rejects invalid entries", () => {
  const history = useFlightNotificationHistory.getState();
  const entry = {
    id: "test",
    category: "system" as const,
    message: "Landing",
    createdAt: 1000,
  };
  history.record(null, entry);
  expect(useFlightNotificationHistory.getState().entries).toHaveLength(0);
  history.record("flight-1", entry);
  history.begin(null);
  expect(useFlightNotificationHistory.getState().entries).toHaveLength(1);
  history.begin("flight-2");
  expect(useFlightNotificationHistory.getState().entries).toEqual([]);
  expect(useFlightNotificationHistory.getState().readCount).toBe(0);
  for (const createdAt of [NaN, -1, 9e15])
    history.record("flight-2", { ...entry, createdAt });
  expect(useFlightNotificationHistory.getState().entries).toEqual([]);
});
