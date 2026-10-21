"""Account-owned logbook summaries; legacy browser checkpoints remain independently protected."""

import json
import math
import os
import urllib.error
import urllib.request
from datetime import datetime
from uuid import UUID


class LogbookError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


def account(authorization):
    if not authorization.startswith("Bearer ") or len(authorization) > 4096:
        raise LogbookError(401, "Sign in required")
    base = os.environ.get("AVIATION_API_URL", "https://aviation.lab.vibecde.com").rstrip("/")
    request = urllib.request.Request(base + "/auth/me", headers={"Authorization": authorization})
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            result = json.load(response)
        username = result.get("username")
        if not isinstance(username, str) or not username:
            raise LogbookError(503, "Account service unavailable")
        return username
    except urllib.error.HTTPError as error:
        raise LogbookError(401 if error.code == 401 else 503, "Account verification failed") from None
    except (OSError, ValueError):
        raise LogbookError(503, "Account service unavailable") from None


def table(db):
    db.execute("""CREATE TABLE IF NOT EXISTS logbook (
        owner TEXT NOT NULL, id TEXT NOT NULL, started_at TEXT NOT NULL,
        data TEXT NOT NULL, pic TEXT NOT NULL, PRIMARY KEY(owner, id))""")


def listing(db, owner, offset):
    table(db)
    rows = db.execute("SELECT data,pic FROM logbook WHERE owner=? ORDER BY started_at DESC,id DESC LIMIT 101 OFFSET ?", (owner, offset)).fetchall()
    return {"entries": [{**json.loads(row[0]), "pic": row[1]} for row in rows[:100]], "hasMore": len(rows) > 100}


def validate(entry, flight_id):
    try:
        if not isinstance(entry, dict) or entry["id"] != flight_id:
            raise ValueError()
        if str(UUID(flight_id)) != flight_id:
            raise ValueError()
        started = datetime.fromisoformat(entry["startedAt"].replace("Z", "+00:00"))
        if started.tzinfo is None:
            raise ValueError()
        limits = {"aircraftType": 100, "registration": 32, "departure": 100, "arrival": 100, "pic": 120}
        for field, limit in limits.items():
            if not isinstance(entry[field], str) or len(entry[field]) > limit:
                raise ValueError()
        if not entry["pic"].strip():
            raise ValueError()
        for field in ("endedAt", "offBlockAt", "takeoffAt", "landingAt", "onBlockAt", "mthBefore", "mthAfter", "fuelBeforeL", "fuelAfterL"):
            value = entry[field]
            if value is not None and (type(value) not in (int, float) or not math.isfinite(value) or value < 0):
                raise ValueError()
        return {key: entry[key] for key in ("id", "startedAt", *limits, "endedAt", "offBlockAt", "takeoffAt", "landingAt", "onBlockAt", "mthBefore", "mthAfter", "fuelBeforeL", "fuelAfterL")}
    except (KeyError, TypeError, ValueError, AttributeError):
        raise LogbookError(422, "Invalid logbook entry") from None


def save(db, owner, flight_id, body):
    entry = validate(body, flight_id)
    table(db)
    previous = db.execute("SELECT data,pic FROM logbook WHERE owner=? AND id=?", (owner, flight_id)).fetchone()
    if previous:
        old = json.loads(previous[0])
        if old["startedAt"] != entry["startedAt"]:
            raise LogbookError(409, "Flight identity changed")
        if old["endedAt"] is not None and entry["endedAt"] is None:
            return {**old, "pic": previous[1]}
    pic = previous[1] if previous else entry["pic"].strip()
    entry["pic"] = pic  # Recording updates must never undo the user's PIC correction.
    db.execute("INSERT INTO logbook VALUES (?,?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET data=excluded.data", (owner, flight_id, entry["startedAt"], json.dumps(entry, allow_nan=False), pic))
    return entry


def edit_pic(db, owner, flight_id, body):
    pic = body.get("pic") if isinstance(body, dict) else None
    if not isinstance(pic, str) or not 1 <= len(pic.strip()) <= 120:
        raise LogbookError(422, "PIC is required")
    table(db)
    if not db.execute("UPDATE logbook SET pic=? WHERE owner=? AND id=?", (pic.strip(), owner, flight_id)).rowcount:
        raise LogbookError(404, "Flight not found")
    return {"pic": pic.strip()}
