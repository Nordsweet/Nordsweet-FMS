"""Private per-browser flight checkpoints. SQLite transactions acknowledge only durable data."""

import hashlib
import json
import math
import os
import re
import sqlite3
from contextlib import contextmanager
from datetime import UTC, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from uuid import UUID
from urllib.parse import urlsplit, parse_qs
import logbook


class StoreError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


@contextmanager
def database():
    path = Path(os.environ.get("FLIGHT_DB_PATH", "data/flights.sqlite3"))
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA synchronous=FULL")
    db.executescript("""
        CREATE TABLE IF NOT EXISTS flights (
            owner TEXT NOT NULL, id TEXT PRIMARY KEY, name TEXT NOT NULL,
            started_at TEXT NOT NULL, registration TEXT NOT NULL,
            revision INTEGER NOT NULL, snapshot TEXT NOT NULL,
            ended INTEGER NOT NULL, updated_at TEXT NOT NULL, request_hash TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS flight_owner ON flights(owner, started_at);
        CREATE TABLE IF NOT EXISTS points (
            flight_id TEXT NOT NULL, seq INTEGER NOT NULL, value TEXT NOT NULL,
            PRIMARY KEY(flight_id, seq)
        );
    """)
    try:
        with db:
            yield db
    finally:
        db.close()


def canonical(value):
    return json.dumps(value, separators=(",", ":"), sort_keys=True, allow_nan=False)


def timestamp(value):
    if not isinstance(value, str):
        raise TypeError("timestamp required")
    result = datetime.fromisoformat(value)
    if result.tzinfo is None:
        raise ValueError("timestamp must include offset")
    return result


def valid_id(value):
    try:
        return str(UUID(value)) == value
    except (ValueError, TypeError, AttributeError):
        return False


def checked(body):
    try:
        if not isinstance(body, dict):
            raise TypeError()
        for key in ("revision", "offset"):
            if type(body[key]) is not int or body[key] < 0:
                raise ValueError()
        if body["revision"] < 1 or not re.fullmatch(
            r"[A-Z0-9]{1,24}\d{10}", body["name"]
        ):
            raise ValueError()
        if not isinstance(body["registration"], str) or len(body["registration"]) > 32:
            raise ValueError()
        timestamp(body["startedAt"])
        if type(body["ended"]) is not bool or not isinstance(body["snapshot"], dict):
            raise ValueError()
        if not isinstance(body["snapshot"].get("flight"), dict) or not isinstance(
            body["snapshot"].get("inflight"), dict
        ):
            raise TypeError()
        if len(canonical(body["snapshot"]).encode()) > 1_500_000:
            raise ValueError()
        if not isinstance(body["points"], list) or len(body["points"]) > 500:
            raise ValueError()
        last = None
        for point in body["points"]:
            for key, low, high in (
                ("lat", -90, 90),
                ("lon", -180, 180),
                ("altitudeFt", -5000, 100000),
            ):
                value = point[key]
                if key == "altitudeFt" and value is None:
                    continue
                if (
                    type(value) not in (int, float)
                    or not math.isfinite(value)
                    or not low <= value <= high
                ):
                    raise ValueError()
            at = timestamp(point["time"])
            if last is not None and at <= last:
                raise ValueError()
            last = at
        return body
    except (KeyError, ValueError, TypeError, OverflowError):
        raise StoreError(422, "Invalid flight checkpoint") from None


def read(owner, flight_id=None):
    with database() as db:
        row = db.execute(
            "SELECT * FROM flights WHERE owner=? AND id=?"
            if flight_id
            else "SELECT * FROM flights WHERE owner=? AND ended=0 ORDER BY started_at DESC LIMIT 1",
            (owner, flight_id) if flight_id else (owner,),
        ).fetchone()
        if row is None:
            if flight_id:
                raise StoreError(404, "Flight not found")
            return None
        points = [
            json.loads(p[0])
            for p in db.execute(
                "SELECT value FROM points WHERE flight_id=? ORDER BY seq", (row["id"],)
            )
        ]
        return {
            "id": row["id"],
            "name": row["name"],
            "startedAt": row["started_at"],
            "registration": row["registration"],
            "revision": row["revision"],
            "ended": bool(row["ended"]),
            "updatedAt": row["updated_at"],
            "snapshot": json.loads(row["snapshot"]),
            "track": points,
        }


def save(owner, flight_id, body):
    b = checked(body)
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute("SELECT * FROM flights WHERE id=?", (flight_id,)).fetchone()
        if row and row["owner"] != owner:
            raise StoreError(404, "Flight not found")
        count = db.execute(
            "SELECT count(*) FROM points WHERE flight_id=?", (flight_id,)
        ).fetchone()[0]
        revision = row["revision"] if row else 0
        digest = hashlib.sha256(canonical(b).encode()).hexdigest()
        if row and (
            row["name"] != b["name"]
            or row["started_at"] != b["startedAt"]
            or row["registration"] != b["registration"]
        ):
            raise StoreError(409, "Flight identity changed")
        if (
            b["revision"] not in (revision, revision + 1)
            or b["offset"] > count
            or (row and row["ended"] and not b["ended"])
        ):
            raise StoreError(409, "Checkpoint conflict; reload the flight")
        if b["revision"] == revision:
            if row["request_hash"] != digest:
                raise StoreError(409, "Concurrent checkpoint conflict")
            return {"revision": revision, "trackCount": count}
        for index, point in enumerate(b["points"], b["offset"]):
            value = canonical(point)
            if index < count:
                existing = db.execute(
                    "SELECT value FROM points WHERE flight_id=? AND seq=?",
                    (flight_id, index),
                ).fetchone()
                if existing[0] != value:
                    raise StoreError(409, "Track prefix conflict")
            elif b["revision"] == revision:
                raise StoreError(409, "Stale checkpoint cannot append points")
            else:
                if index > 0:
                    previous = db.execute(
                        "SELECT value FROM points WHERE flight_id=? AND seq=?",
                        (flight_id, index - 1),
                    ).fetchone()
                    if timestamp(point["time"]) <= timestamp(
                        json.loads(previous[0])["time"]
                    ):
                        raise StoreError(422, "Track timestamps must increase")
                db.execute(
                    "INSERT INTO points VALUES (?,?,?)", (flight_id, index, value)
                )
        if b["revision"] == revision + 1:
            db.execute(
                """INSERT INTO flights VALUES (?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(id) DO UPDATE SET revision=excluded.revision, snapshot=excluded.snapshot,
                ended=excluded.ended, updated_at=excluded.updated_at, request_hash=excluded.request_hash""",
                (
                    owner,
                    flight_id,
                    b["name"],
                    b["startedAt"],
                    b["registration"],
                    b["revision"],
                    canonical(b["snapshot"]),
                    int(b["ended"]),
                    datetime.now(UTC).isoformat(),
                    digest,
                ),
            )
        count = db.execute(
            "SELECT count(*) FROM points WHERE flight_id=?", (flight_id,)
        ).fetchone()[0]
        return {"revision": b["revision"], "trackCount": count}


def close(owner, flight_id):
    with database() as db:
        if not db.execute(
            "SELECT 1 FROM flights WHERE owner=? AND id=?", (owner, flight_id)
        ).fetchone():
            raise StoreError(404, "Flight not found")
        db.execute(
            "UPDATE flights SET ended=1 WHERE owner=? AND id=?", (owner, flight_id)
        )
    return {"closed": True}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # Bearer capabilities and flight payloads must never reach access logs.

    def do_GET(self):
        self.handle_request(False)

    def do_POST(self):
        self.handle_request(True)

    def handle_request(self, post):
        try:
            url = urlsplit(self.path)
            if url.path == "/flight-sync/logbook" or url.path.startswith("/flight-sync/logbook/"):
                owner = logbook.account(self.headers.get("Authorization", ""))
                parts = url.path.rstrip("/").split("/")
                with database() as db:
                    if not post and len(parts) == 3:
                        offset = int(parse_qs(url.query).get("offset", ["0"])[0])
                        if offset < 0:
                            raise logbook.LogbookError(422, "Invalid offset")
                        result = logbook.listing(db, owner, offset)
                    elif post and len(parts) in (4, 5) and valid_id(parts[3]):
                        length = int(self.headers.get("Content-Length", "0"))
                        if not 0 < length <= 10000:
                            raise logbook.LogbookError(413, "Entry too large")
                        body = json.loads(self.rfile.read(length))
                        if len(parts) == 4:
                            result = logbook.save(db, owner, parts[3], body)
                        elif parts[4] == "pic":
                            result = logbook.edit_pic(db, owner, parts[3], body)
                        else:
                            raise logbook.LogbookError(404, "Not found")
                    else:
                        raise logbook.LogbookError(404, "Not found")
                self.reply(200, result)
                return
            if not post and self.path == "/flight-sync/health":
                with database() as db:
                    db.execute("SELECT 1").fetchone()
                self.reply(200, {"status": "ok"})
                return
            token = self.headers.get("Authorization", "")
            if not re.fullmatch(r"Bearer [a-f0-9]{64}", token):
                raise StoreError(401, "Browser capability required")
            owner = hashlib.sha256(token.encode()).hexdigest()
            parts = url.path.rstrip("/").split("/")
            if parts[:3] != ["", "flight-sync", "sessions"]:
                raise StoreError(404, "Not found")
            flight_id = parts[3] if len(parts) >= 4 else None
            if flight_id and not valid_id(flight_id):
                raise StoreError(404, "Not found")
            if post:
                if not flight_id:
                    raise StoreError(404, "Not found")
                if len(parts) == 5 and parts[4] == "close":
                    result = close(owner, flight_id)
                elif len(parts) == 4:
                    length = int(self.headers.get("Content-Length", "0"))
                    if not 0 < length <= 2_000_000:
                        raise StoreError(413, "Checkpoint too large")
                    try:
                        body = json.loads(self.rfile.read(length))
                    except (ValueError, UnicodeError):
                        raise StoreError(422, "Invalid JSON") from None
                    result = save(owner, flight_id, body)
                else:
                    raise StoreError(404, "Not found")
            else:
                if len(parts) > 4:
                    raise StoreError(404, "Not found")
                if flight_id is None and "offset" in parse_qs(url.query):
                    offset = int(parse_qs(url.query)["offset"][0])
                    if offset < 0:
                        raise StoreError(422, "Invalid offset")
                    with database() as db:
                        rows = db.execute("SELECT id,started_at,snapshot FROM flights WHERE owner=? ORDER BY started_at DESC,id DESC LIMIT 101 OFFSET ?", (owner, offset)).fetchall()
                        result = {"flights": [{"id": row["id"], "startedAt": row["started_at"], "snapshot": json.loads(row["snapshot"])} for row in rows[:100]], "hasMore": len(rows) > 100}
                else:
                    result = read(owner, flight_id)
            self.reply(200, result)
        except (StoreError, logbook.LogbookError) as error:
            self.reply(error.status, {"detail": error.message})
        except (sqlite3.Error, OSError):
            self.reply(503, {"detail": "Flight storage unavailable"})
        except ValueError:
            self.reply(422, {"detail": "Invalid request"})

    def reply(self, status, body):
        data = json.dumps(body, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    ThreadingHTTPServer(
        ("0.0.0.0", int(os.environ.get("PORT", "8000"))), Handler
    ).serve_forever()
