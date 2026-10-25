import { expect, test } from "./test";
import { newFlight } from "../src/data/flight";

test("climb crossing ATZ to FIS and entering TMA both suggest the current local service", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.clock.install({ time: new Date("2026-10-20T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-20T12:00:01Z"));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.route("**/data/frequencies.json", (r) =>
    r.fulfill({
      json: [
        {
          airport: "LZTT",
          service: "tower",
          callsign: "Tatry Tower",
          frequencyMhz: "122.305",
          sector: null,
          notes: null,
          primary: false,
        },
      ],
    }),
  );
  await page.route("https://aviation.lab.vibecde.com/airports/LZTT/atis", (r) =>
    r.fulfill({
      json: {
        icao: "LZTT",
        sources: {},
        atis: [
          {
            kind: "combined",
            letter: "B",
            qnh_hpa: 1015,
            stale: false,
            received_at: "2026-10-20T11:45:00Z",
            age_minutes: 15,
            qnh_matches_metar: null,
            text: "LZTT ATIS B QNH 1015",
          },
        ],
      },
    }),
  );
  const zone = (
    name: string,
    west: number,
    east: number,
    frequencyMhz: string,
    callsign: string,
    lower = "GND",
  ) => ({
    type: "Feature",
    bbox: [west, 49, east, 51],
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [west, 49],
          [east, 49],
          [east, 51],
          [west, 51],
          [west, 49],
        ],
      ],
    },
    properties: {
      name,
      class: name.split(" ")[0],
      lower,
      upper: "FL095",
      active_now: true,
      activations: [],
      frequencies: [
        {
          frequencyMhz,
          callsign,
          sector: null,
          serviceId: name.startsWith("TMA")
            ? "zblizanie"
            : name.startsWith("FIS")
              ? "fiss"
              : "radio",
        },
      ],
    },
  });
  const features = [
    zone("ATZ TEST", 19.8, 20.1, "122.305", "Tatry-Tower"),
    zone("FIS LOCAL", 19, 22, "119.275", "Bratislava Information"),
    zone("TMA TEST", 20.5, 21, "121.075", "Test Approach", "4000 FT AMSL"),
    ...[
      ["LZCTR TATRY", "", ""],
      ["LKCTR TEST", "120.000", "Praha Radar"],
      ["EDCTR TEST", "121.000", "Berlin Tower"],
      ["EYCTR TEST", "122.000", "Vilnius Information"],
      ["CTR POLISH", "122.305", "Nowy Targ Radio"],
    ].map(([name, frequency, callsign]) => {
      const feature = zone(name!, 19.9, 20.9, frequency!, callsign!, "FL180");
      return {
        ...feature,
        properties: {
          ...feature.properties,
          class: "CTR",
          upper: "FL195",
          frequencies: frequency ? feature.properties.frequencies : [],
        },
      };
    }),
  ];
  await page.route("https://aviation.lab.vibecde.com/airspace**", (r) =>
    r.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        type: "FeatureCollection",
        features,
        sources: { test: "ok" },
      }),
    }),
  );
  const route = [
    { ident: "A", lat: 50, lon: 20 },
    { ident: "B", lat: 50, lon: 21, altitudeFt: 5000 },
  ];
  await page.addInitScript(
    ({ flight, route }) => {
      localStorage.setItem("nordsweet.language.v1", "en");
      if (!localStorage.getItem("nordsweet.flight.v2"))
        localStorage.setItem(
          "nordsweet.flight.v2",
          JSON.stringify({ version: 1, state: { flight } }),
        );
      if (!localStorage.getItem("nordsweet.inflight.v1"))
        localStorage.setItem(
          "nordsweet.inflight.v1",
          JSON.stringify({
            version: 1,
            state: {
              startedAt: new Date().toISOString(),
              phase: "climb",
              route,
              activeLeg: 0,
            },
          }),
        );
      navigator.geolocation.watchPosition = (success) => {
        const sample = () =>
          success({
            timestamp: Date.now(),
            coords: {
              latitude: 50,
              longitude: Number(localStorage.getItem("test.radio.lon") ?? 20),
              altitude: 5000 * 0.3048,
              heading: 90,
              speed: 100 / 1.943844,
              accuracy: 5,
              altitudeAccuracy: 5,
            },
          } as GeolocationPosition);
        sample();
        return window.setInterval(sample, 1000);
      };
      navigator.geolocation.clearWatch = (id) => window.clearInterval(id);
    },
    {
      flight: {
        ...newFlight(),
        departure: route[0],
        destination: route[1],
        cruiseAltitudeFt: 5000,
      },
      route,
    },
  );
  const atisLoaded = page.waitForResponse(
    "https://aviation.lab.vibecde.com/airports/LZTT/atis",
  );
  await page.goto("/fly");
  await expect(page.getByTestId("flight-status-bar")).toBeVisible();
  await page.getByRole("button", { name: "COMMs", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "COMMs", exact: true }),
  ).toContainText("Tatry-Tower");
  const comms = page.getByRole("dialog", { name: "COMMs", exact: true });
  await expect(comms.locator("details")).toHaveCount(0);
  for (const [station, phrases] of [
    ["Tatry-Tower", ["Dobrý deň", "Ďakujem", "Dovidenia", "Dopočutia"]],
    [
      "Bratislava Information",
      ["Dobrý deň", "Ďakujem", "Dovidenia", "Dopočutia"],
    ],
    ["LZCTR TATRY", ["Dobrý deň", "Ďakujem", "Dovidenia", "Dopočutia"]],
    ["LKCTR TEST", ["Dobrý den", "Děkuji", "Na shledanou", "Na slyšenou"]],
    ["EYCTR TEST", ["Laba diena", "Ačiū", "Viso gero"]],
    [
      "EDCTR TEST",
      ["Guten Tag", "Danke", "Auf Wiedersehen", "Auf Wiederhören"],
    ],
  ] as const) {
    const label = `Greetings and farewells: ${station}`;
    const trigger = comms
      .getByRole("button", { name: label, exact: true })
      .first();
    const guide = page.getByRole("dialog", { name: label, exact: true });
    await expect(guide).toBeHidden();
    await trigger.click();
    for (const phrase of phrases)
      await expect(guide.getByText(phrase, { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(guide).toBeHidden();
    // Radix restores focus on the next timer tick; this scenario pauses the clock.
    await page.clock.runFor(10);
    await expect(trigger).toBeFocused();
  }
  await expect(
    comms.getByRole("button", {
      name: "Greetings and farewells: Nowy Targ Radio",
      exact: true,
    }),
  ).toHaveCount(0);
  const emptyGroup = comms
    .getByRole("heading", { name: "LZCTR TATRY", exact: true })
    .locator("../..");
  await expect(emptyGroup).toContainText("Not available");
  // The same icon and popover fit a narrow viewport, without expanding the radio row.
  await page.setViewportSize({ width: 390, height: 844 });
  const narrowLabel = "Greetings and farewells: LZCTR TATRY";
  await comms.getByRole("button", { name: narrowLabel, exact: true }).click();
  const narrowGuide = page.getByRole("dialog", {
    name: narrowLabel,
    exact: true,
  });
  await expect(narrowGuide).toBeVisible();
  const box = (await narrowGuide.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/radio-language-info.png" });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("button", { name: "COMMs", exact: true }).click();
  const frequency = page
    .getByTestId("flight-notifications")
    .getByRole("status", { name: "Frequency", exact: true });
  await expect(frequency).toContainText("Switch to Tatry-Tower, 122.305 MHz");
  await atisLoaded;
  await page.clock.runFor(100);
  await expect(frequency).toContainText(
    "(Information B, QNH 1015, updated 15 min ago)",
  );
  await frequency
    .getByRole("button", { name: "Dismiss Frequency", exact: true })
    .click();
  await page.evaluate(() => localStorage.setItem("test.radio.lon", "20.2"));
  await page.clock.runFor(3000);
  await expect(frequency).toContainText(
    "Switch to Bratislava Information, 119.275 MHz",
  );
  await expect(frequency).not.toContainText("Information B");
  await frequency
    .getByRole("button", { name: "Dismiss Frequency", exact: true })
    .click();
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await page.getByRole("button", { name: "FREDA CHECK", exact: true }).click();
  const freda = page.getByRole("dialog", { name: "FREDA", exact: true });
  const radio = freda
    .getByRole("heading", { name: "R — Radio", exact: true })
    .locator("..");
  await expect(
    radio.getByText("Current", { exact: true }).locator(".."),
  ).toContainText("119.275 Bratislava Information");
  await expect(
    radio.getByText("Next", { exact: true }).locator(".."),
  ).toContainText("121.075 Test Approach");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await page.reload();
  await expect(page.getByTestId("flight-status-bar")).toBeVisible();
  await page.getByRole("button", { name: "COMMs", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "COMMs", exact: true }),
  ).toContainText("Bratislava Information");
  await page.getByRole("button", { name: "COMMs", exact: true }).click();
  await page.clock.runFor(2000);
  await expect(frequency).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem("test.radio.lon", "20.6"));
  await page.clock.runFor(3000);
  await expect(frequency).toContainText("Switch to Test Approach, 121.075 MHz");
  for (const [lon, message] of [
    ["20.2", "Switch to Bratislava Information, 119.275 MHz"],
    ["20", "Switch to Tatry-Tower, 122.305 MHz"],
    ["20.2", "Switch to Bratislava Information, 119.275 MHz"],
  ]) {
    await frequency
      .getByRole("button", { name: "Dismiss Frequency", exact: true })
      .click();
    await page.evaluate(
      (value) => localStorage.setItem("test.radio.lon", value!),
      lon,
    );
    await page.clock.runFor(3000);
    await expect(frequency).toContainText(message!);
  }
});
