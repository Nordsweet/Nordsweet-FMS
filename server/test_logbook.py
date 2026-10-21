import json
import os
import tempfile
import threading
import urllib.request
from http.server import ThreadingHTTPServer
import unittest
from unittest.mock import patch
from uuid import uuid4

import logbook
from flight_store import database, Handler


class LogbookTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, {"FLIGHT_DB_PATH": self.temp.name + "/flights.sqlite3"})
        self.env.start()
        self.entry = {"id": str(uuid4()), "startedAt": "2026-10-21T23:30:00Z", "endedAt": None, "aircraftType": "C172", "registration": "SP-ABC", "departure": "EPKK", "arrival": "EPNT", "pic": "Kowalski", **dict.fromkeys(("offBlockAt", "takeoffAt", "landingAt", "onBlockAt", "mthBefore", "mthAfter", "fuelBeforeL", "fuelAfterL"))}

    def tearDown(self):
        self.env.stop()
        self.temp.cleanup()

    def save(self, owner="pilot", entry=None):
        entry = self.entry if entry is None else entry
        with database() as db:
            return logbook.save(db, owner, entry["id"], entry)

    def test_account_isolation_and_pic_correction_survives_stale_recording(self):
        self.save()
        with database() as db:
            self.assertEqual(logbook.listing(db, "other", 0)["entries"], [])
            with self.assertRaises(logbook.LogbookError) as error:
                logbook.edit_pic(db, "other", self.entry["id"], {"pic": "intruder"})
            self.assertEqual(error.exception.status, 404)
            logbook.edit_pic(db, "pilot", self.entry["id"], {"pic": " Nowak "})
        self.assertEqual(self.save()["pic"], "Nowak")
        with database() as db:
            self.assertEqual(logbook.listing(db, "pilot", 0)["entries"][0]["pic"], "Nowak")

    def test_ended_cannot_be_reopened_and_same_session_does_not_duplicate(self):
        ended = {**self.entry, "endedAt": 1000, "mthAfter": 23.4}
        self.save(entry=ended)
        self.assertEqual(self.save()["endedAt"], 1000)
        with database() as db:
            self.assertEqual(len(logbook.listing(db, "pilot", 0)["entries"]), 1)
        with self.assertRaises(logbook.LogbookError):
            self.save(entry={**self.entry, "startedAt": "2026-10-22T00:00:00Z"})

    def test_all_pages_and_order(self):
        for n in range(103):
            self.save(entry={**self.entry, "id": str(uuid4()), "registration": str(n)})
        with database() as db:
            a = logbook.listing(db, "pilot", 0)
            b = logbook.listing(db, "pilot", 100)
        self.assertTrue(a["hasMore"])
        self.assertFalse(b["hasMore"])
        self.assertEqual(len({e["id"] for e in a["entries"] + b["entries"]}), 103)

    def test_rejects_invalid_fields_and_empty_pic(self):
        for field, value in [("pic", " "), ("pic", "x" * 121), ("mthAfter", float("nan")), ("landingAt", True), ("startedAt", "2026-10-21T00:00:00"), ("fuelAfterL", -1)]:
            with self.subTest(field=field), self.assertRaises(logbook.LogbookError):
                self.save(entry={**self.entry, field: value})

    def test_authentication_uses_verified_account_not_client_claim(self):
        with self.assertRaises(logbook.LogbookError):
            logbook.account("")
        response = unittest.mock.MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps({"username": "verified-pilot"}).encode()
        with patch("urllib.request.urlopen", return_value=response) as request:
            self.assertEqual(logbook.account("Bearer valid"), "verified-pilot")
            self.assertEqual(request.call_args.args[0].get_header("Authorization"), "Bearer valid")

    def test_http_routes_verify_accounts_and_persist_pic(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{server.server_port}/flight-sync/logbook"
        def request(path="", body=None, token="pilot"):
            req = urllib.request.Request(base + path, None if body is None else json.dumps(body).encode(), {"Authorization": "Bearer " + token, "Content-Type": "application/json"})
            with urllib.request.urlopen(req) as response:
                return json.load(response)
        try:
            with patch("logbook.account", side_effect=lambda auth: auth.removeprefix("Bearer ")) as verify:
                self.assertEqual(request("/" + self.entry["id"], self.entry)["pic"], "Kowalski")
                request("/" + self.entry["id"] + "/pic", {"pic": "Nowak"})
                self.assertEqual(request()["entries"][0]["pic"], "Nowak")
                self.assertEqual(request(token="other")["entries"], [])
                self.assertEqual(verify.call_count, 4)
            with patch("logbook.account", side_effect=logbook.LogbookError(401, "Sign in required")):
                with self.assertRaises(urllib.error.HTTPError) as error:
                    request()
                self.assertEqual(error.exception.code, 401)
        finally:
            server.shutdown()
            server.server_close()
