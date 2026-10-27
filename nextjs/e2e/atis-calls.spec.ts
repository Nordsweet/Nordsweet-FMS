import { expect, test, type Page } from "./test";

async function setup(page: Page, enabled: boolean) {
  let id = "";
  let status: "queued" | "ready" = "queued";
  let transcribed = false;
  let misheard = false;
  let posts = 0;
  const message = () =>
    misheard
      ? { text: null, error: null, changed: false, misheard: true, redo: false }
      : {
          text: "EPKK INFORMATION A WIND 270 DEGREES 10 KNOTS QNH 1013",
          error: null,
          changed: false,
          misheard: false,
          redo: false,
        };
  const account = () => ({
    username: "grzes",
    enabled,
    airports: ["EPKK"],
    requests: id
      ? [
          {
            id,
            icao: "EPKK",
            status,
            created_at: Date.now() / 1000,
            updated_at: Date.now() / 1000,
            error: null,
            transcript: transcribed ? "raw transcript" : null,
            transcript_error: null,
            message: transcribed ? message() : null,
          },
        ]
      : [],
  });
  await page.addInitScript(() =>
    localStorage.setItem("nordsweet.language.v1", "en"),
  );
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await page.route("https://aviation.lab.vibecde.com/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/atis-calls") return route.fulfill({ json: account() });
    if (path === "/airports/EPKK/atis-call") {
      posts++;
      id = (route.request().postDataJSON() as { request_id: string })
        .request_id;
      return route.fulfill({
        status: 202,
        json: { ...account(), request_id: id },
      });
    }
    if (path === "/airports/EPKK/atis-message")
      return route.fulfill({
        json: {
          icao: "EPKK",
          captured_at: transcribed && !misheard ? Date.now() / 1000 : null,
          message: transcribed && !misheard ? message() : null,
        },
      });
    if (path === "/airports/EPKK/weather")
      return route.fulfill({
        json: { icao: "EPKK", metar: null, taf: "TAF TEST", sources: {} },
      });
    if (path === "/airports/EPKK/atis")
      return route.fulfill({
        json: {
          icao: "EPKK",
          sources: {},
          atis:
            status === "ready"
              ? [
                  {
                    id,
                    kind: "combined",
                    source: "telephone-atis",
                    letter: "A",
                    received_at: new Date().toISOString(),
                    observed_at: new Date().toISOString(),
                    age_minutes: 0,
                    stale: false,
                    qnh_hpa: 1013,
                    qnh_matches_metar: null,
                    verified: true,
                    confirmation_count: 0,
                    text: "TELEPHONE ATIS WIND 27010KT QNH 1013",
                    fields: { wind: "27010KT", qnh: "1013" },
                  },
                ]
              : [],
        },
      });
    return route.fulfill({
      json: {
        places: [],
        sources: {},
        aircraft: [],
        count: 0,
        type: "FeatureCollection",
        features: [],
      },
    });
  });
  return {
    /** The call is over; the text arrives separately. */
    ready: () => {
      status = "ready";
    },
    transcribe: (wrong = false) => {
      status = "ready";
      transcribed = true;
      misheard = wrong;
    },
    posts: () => posts,
  };
}

async function weather(page: Page) {
  await page.goto("/map");
  await expect(page.getByTestId("map")).toHaveAttribute(
    "data-map-ready",
    "true",
  );
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Search", exact: true });
  await search.getByRole("textbox").fill("EPKK");
  await search.getByRole("button", { name: "Search", exact: true }).click();
  const details = page.getByRole("dialog", { name: "Details", exact: true });
  await details.getByRole("button", { name: "Weather", exact: true }).click();
  return details;
}

test("telephone request is sent once, survives navigation/reload and View opens airport Weather", async ({
  page,
}) => {
  const server = await setup(page, true);
  const details = await weather(page);
  await expect(details.getByText("No telephone ATIS yet.")).toBeVisible();
  await details
    .getByRole("button", {
      name: "Request ATIS Call",
      exact: true,
    })
    .click();
  await expect(
    details.getByRole("button", { name: "Requesting", exact: true }),
  ).toBeDisabled();
  await page.goto("/settings");
  await page.reload();
  server.ready();
  // "ready" alone is not the end: nothing is announced until the text exists.
  await page.waitForResponse((r) => r.url().endsWith("/atis-calls"), {
    timeout: 20000,
  });
  await expect(page.getByTestId("atis-call-notice")).toHaveCount(0);
  server.transcribe();
  const popup = page.getByTestId("atis-call-notice");
  await expect(popup).toContainText("EPKK ATIS available", { timeout: 20000 });
  await popup.getByRole("button", { name: "View", exact: true }).click();
  await expect(page).toHaveURL(/\/map$/);
  const wx = page.getByTestId("wx-selected");
  await expect(wx).toContainText("Telephone ATIS");
  await expect(wx).toContainText("EPKK INFORMATION A WIND 270");
  await wx.getByText(/ATIS \/ D-ATIS/).click();
  await expect(wx).toContainText("TELEPHONE ATIS WIND 27010KT QNH 1013");
  expect(server.posts()).toBe(1);
  await page.reload();
  await expect(page.getByTestId("atis-call-notice")).toHaveCount(0);
});

test("pending provider verification disables the request and never submits it", async ({
  page,
}) => {
  const server = await setup(page, false);
  await page.goto("/settings");
  const details = await weather(page);
  await expect(
    details.getByRole("button", {
      name: "Request ATIS Call",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(details).toContainText("awaiting provider activation");
  expect(server.posts()).toBe(0);
});

test("a misheard ATIS is warned about and can be called again", async ({
  page,
}) => {
  const server = await setup(page, true);
  const details = await weather(page);
  await details.getByRole("button", { name: "Request ATIS Call" }).click();
  server.transcribe(true);
  const popup = page.getByTestId("atis-call-notice");
  await expect(popup).toContainText("A letter was misheard.", {
    timeout: 20000,
  });
  await expect(popup).toContainText("EPKK ATIS could not be read.");
  await popup.getByRole("button", { name: "Call again", exact: true }).click();
  await expect.poll(server.posts).toBe(2);
});
