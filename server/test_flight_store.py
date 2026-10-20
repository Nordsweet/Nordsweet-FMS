import json
import os
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from unittest.mock import patch
from uuid import uuid4

from flight_store import Handler, StoreError, close, read, save


def point(second):
    return {
        "lat": 50 + second / 10000,
        "lon": 20,
        "altitudeFt": 5000,
        "time": f"2026-10-19T21:30:{second:02}Z",
    }


def checkpoint(**overrides):
    return {
        "name": "SPOKO1910262330",
        "startedAt": "2026-10-19T21:30:00Z",
        "registration": "SP-OKO",
        "revision": 1,
        "offset": 0,
        "points": [point(0)],
        "ended": False,
        "snapshot": {
            "flight": {"id": "plan"},
            "inflight": {"startedAt": "2026-10-19T21:30:00Z"},
        },
        **overrides,
    }


class FlightStoreTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.env = patch.dict(
            os.environ, {"FLIGHT_DB_PATH": self.temp.name + "/flights.sqlite3"}
        )
        self.env.start()
        self.id = str(uuid4())

    def tearDown(self):
        self.env.stop()
        self.temp.cleanup()

    def test_incremental_durable_and_idempotent(self):
        first = checkpoint()
        self.assertEqual(
            save("owner", self.id, first), {"revision": 1, "trackCount": 1}
        )
        second = checkpoint(revision=2, offset=1, points=[point(5), point(10)])
        self.assertEqual(save("owner", self.id, second)["trackCount"], 3)
        self.assertEqual(save("owner", self.id, second)["trackCount"], 3)
        # Each call opens a fresh connection: no process-memory cache can produce this result.
        restored = read("owner")
        self.assertEqual(restored["track"], [point(0), point(5), point(10)])
        self.assertEqual(restored["name"], "SPOKO1910262330")
        self.assertEqual(restored["snapshot"]["flight"]["id"], "plan")

    def test_conflicts_do_not_truncate_or_overwrite(self):
        save("owner", self.id, checkpoint())
        cases = [
            checkpoint(revision=2, offset=5),
            checkpoint(revision=4),
            checkpoint(revision=2, points=[{**point(0), "lat": 51}]),
            checkpoint(snapshot={"flight": {}, "inflight": {}}),
        ]
        for body in cases:
            with self.assertRaises(StoreError) as caught:
                save("owner", self.id, body)
            self.assertEqual(caught.exception.status, 409)
        self.assertEqual(read("owner")["track"], [point(0)])

    def test_atomic_rollback_invalid_tail(self):
        save("owner", self.id, checkpoint())
        with self.assertRaises(StoreError):
            save(
                "owner",
                self.id,
                checkpoint(revision=2, offset=1, points=[point(5), point(0)]),
            )
        self.assertEqual(read("owner")["revision"], 1)
        self.assertEqual(len(read("owner")["track"]), 1)

    def test_private_and_archived_records(self):
        save("owner", self.id, checkpoint())
        self.assertIsNone(read("other"))
        with self.assertRaises(StoreError) as caught:
            read("other", self.id)
        self.assertEqual(caught.exception.status, 404)
        with self.assertRaises(StoreError):
            save("other", self.id, checkpoint())
        close("owner", self.id)
        self.assertIsNone(read("owner"))
        self.assertTrue(read("owner", self.id)["ended"])
        with self.assertRaises(StoreError):
            save("owner", self.id, checkpoint(revision=2))

    def test_invalid_frames(self):
        cases = [
            checkpoint(points=[{**point(0), "lat": float("nan")}]),
            checkpoint(points=[{**point(0), "lon": 181}]),
            checkpoint(points=[{**point(0), "time": "bad"}]),
            checkpoint(name="../../escape"),
            checkpoint(offset=-1),
            checkpoint(ended="false"),
        ]
        for body in cases:
            with self.assertRaises(StoreError) as caught:
                save("owner", self.id, body)
            self.assertEqual(caught.exception.status, 422)
        self.assertIsNone(read("owner"))

    def test_same_minute_flights_have_independent_ids(self):
        save("owner", self.id, checkpoint())
        other = str(uuid4())
        save("owner", other, checkpoint())
        self.assertEqual(len(read("owner", self.id)["track"]), 1)
        self.assertEqual(len(read("owner", other)["track"]), 1)

    def test_http_auth_limits_and_storage(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f"http://127.0.0.1:{server.server_port}/flight-sync/sessions"
        try:
            with urllib.request.urlopen(
                url.replace("/sessions", "/health")
            ) as response:
                self.assertEqual(json.load(response), {"status": "ok"})
            with self.assertRaises(urllib.error.HTTPError) as caught:
                urllib.request.urlopen(url)
            self.assertEqual(caught.exception.code, 401)
            auth = {
                "Authorization": "Bearer " + "a" * 64,
                "Content-Type": "application/json",
            }
            request = urllib.request.Request(
                url + "/" + self.id, json.dumps(checkpoint()).encode(), auth
            )
            with urllib.request.urlopen(request) as response:
                self.assertEqual(json.load(response)["trackCount"], 1)
            with urllib.request.urlopen(
                urllib.request.Request(url, headers=auth)
            ) as response:
                self.assertEqual(response.headers["Cache-Control"], "no-store")
                self.assertEqual(len(json.load(response)["track"]), 1)
            with self.assertRaises(urllib.error.HTTPError) as caught:
                urllib.request.urlopen(
                    urllib.request.Request(
                        url + "/" + self.id,
                        headers={**auth, "Authorization": "Bearer " + "b" * 64},
                    )
                )
            self.assertEqual(caught.exception.code, 404)
        finally:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    unittest.main()
