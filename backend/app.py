"""
normituary backend — Railway edition
====================================
Memorial renderer + EIP-712 death-voucher signer + cached Normies API proxy.
No nginx needed: caching and CORS live here. HTTPS comes from Railway.

Routes
  GET  /memorial/<id>             ERC-721 metadata JSON (baseURI target)
  GET  /memorial/<id>/image.svg   headstone SVG (frozen design)
  POST /voucher                   signed DeathVoucher {voucher, signature, phase}
  GET  /api/<path>                cached passthrough to api.normies.art (site data)
  GET  /health

Railway Variables (Settings -> Variables)
  SIGNER_KEY        0x...      voucher signer private key
  CONTRACT_ADDRESS  0x...      deployed Normituary contract
  CHAIN_ID          11155111 (sepolia) | 1 (mainnet)
  LAUNCH_TIME       contract launchTime() unix ts
  PUBLIC_BASE       https://<this-service>.up.railway.app
  ALLOWED_ORIGINS   https://<site>.up.railway.app,http://localhost:5173
"""
import os, time, base64, threading
from pathlib import Path

import requests as rq
from flask import Flask, jsonify, request, Response, abort
from flask_cors import CORS
from eth_account import Account
from eth_utils import is_address, to_checksum_address

SIGNER_KEY  = os.environ["SIGNER_KEY"]
CONTRACT    = to_checksum_address(os.environ["CONTRACT_ADDRESS"])
CHAIN_ID    = int(os.environ["CHAIN_ID"])
LAUNCH_TIME = int(os.environ["LAUNCH_TIME"])
PUBLIC_BASE = os.environ.get("PUBLIC_BASE", "").rstrip("/")
NORMIES_API = os.environ.get("NORMIES_API", "https://api.normies.art").rstrip("/")
ORIGINS     = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",")]

MOURNING = 30 * 24 * 3600
SIGNER   = Account.from_key(SIGNER_KEY)
CACHE    = Path(os.environ.get("CACHE_DIR", "/tmp/normituary-cache")); CACHE.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)
CORS(app, origins=ORIGINS)

# ----------------------------------------------------------------------
# Normies API access with in-process TTL cache (replaces the nginx layer)
# ----------------------------------------------------------------------
_mem, _lock = {}, threading.Lock()
YEAR = 365 * 24 * 3600

def _ttl_for(path):
    if path.startswith("/history/burned/"):                       return YEAR   # the dead don't change
    if path.startswith("/history/burns/") and path[15:].lstrip("/").split("?")[0].isdigit():
        return 3600                                                              # commit detail
    if path.startswith("/history/"):                               return 30
    if path.startswith(("/normie/", "/agents/")):                  return 300
    if path.startswith(("/holders/", "/canvas/")):                 return 60
    return 30

def api_fetch(path, as_text=False):
    """GET with TTL memory cache; serves stale copy if upstream fails."""
    key = ("T" if as_text else "J") + path
    now = time.time()
    with _lock:
        hit = _mem.get(key)
        if hit and hit[0] > now:
            return hit[1]
    try:
        r = rq.get(NORMIES_API + path, timeout=8)
        if r.status_code == 404:
            with _lock: _mem[key] = (now + 60, None)
            abort(404)
        r.raise_for_status()
        data = r.text if as_text else r.json()
        with _lock: _mem[key] = (now + _ttl_for(path), data)
        return data
    except rq.RequestException:
        with _lock:
            hit = _mem.get(key)
        if hit and hit[1] is not None:
            return hit[1]                                          # stale-on-error
        abort(502, "normies api unreachable")

def burn_record(token_id):
    info = api_fetch(f"/history/burned/{token_id}")
    if info is None: abort(404)
    commit_id = info.get("commitId") or info.get("commit_id")
    commit = api_fetch(f"/history/burns/{commit_id}")
    if not commit.get("revealed") or commit.get("expired"):
        abort(409, "burn commitment not revealed or expired")
    return {"commitId": commit_id,
            "pixelCount": info.get("pixelCount") or info.get("pixel_count") or 0,
            "burner": to_checksum_address(commit["owner"]),
            "timestamp": int(commit["timestamp"])}

def burned_portrait_datauri(token_id):
    f = CACHE / f"burned-{token_id}.svg"
    if not f.exists():
        try:
            svg_text = api_fetch(f"/history/burned/{token_id}/image.svg", as_text=True)
            f.write_text(svg_text)
        except Exception:
            return None   # deixa href=None, usa fallback procedural
    try:
        return "data:image/svg+xml;base64," + base64.b64encode(f.read_bytes()).decode()
    except Exception:
        return None

# ----------------------------------------------------------------------
# SVG renderer — frozen design, LCG-identical to the site generator
# ----------------------------------------------------------------------
INK, PAPER = "#48494b", "#e3e5e4"

def arch_pts():
    return [(800,880),(800,320),(790,320),(790,262),(776,262),(776,216),
            (758,216),(758,180),(734,180),(734,152),(704,152),(704,130),
            (664,130),(664,112),(614,112),(614,100)]

def step_path(right):
    left = [(1000-x, y) for x, y in right][::-1]
    pts  = right + left + [(1000-right[0][0], right[0][1])]
    return f"M {right[0][0]} {right[0][1]} " + " ".join(f"L {x} {y}" for x, y in pts) + " Z"

def headstone_path():       return step_path(arch_pts())
def headstone_inner_path(): return step_path([(x-28, min(y+28, 850)) for x, y in arch_pts()])

def stone_speckles(token_id):
    s = (token_id * 2654435761) % 2147483647 or 7
    def rnd():
        nonlocal s
        s = (s * 16807) % 2147483647
        return s / 2147483647
    out = []
    for _ in range(46):
        x = 240 + int(rnd() * 520)
        y = 160 + int(rnd() * 670)
        w = 10 if rnd() > .8 else 6
        out.append(f'<rect x="{x}" y="{y}" width="{w}" height="6"/>')
    return f'<g fill="{INK}" fill-opacity=".08" shape-rendering="crispEdges">{"".join(out)}</g>'

def face_fallback(seed):
    s = seed + 1
    def rnd():
        nonlocal s
        s = (s * 16807) % 2147483647
        return s / 2147483647
    on = []
    for y in range(6, 36):
        for x in range(8, 32):
            dx, dy = (x-20)/11, (y-21)/14
            if 0.82 < dx*dx + dy*dy < 1: on.append((x, y))
    for y in range(5, 12):
        for x in range(9, 31):
            dx, dy = (x-20)/11, (y-21)/14
            if dx*dx + dy*dy < 1 and rnd() > .45: on.append((x, y))
    ey = 17 + int(rnd() * 2)
    for ex in (14, 24):
        on += [(ex,ey),(ex+1,ey),(ex,ey+1),(ex+1,ey+1)]
    on += [(19,24),(20,24)] + [(x,29) for x in range(16,24)]
    return on

def memorial_svg(token_id, portrait_href=None):
    PX, POX, POY = 520, 240, 230
    if portrait_href:
        portrait = (f'<image href="{portrait_href}" x="{POX}" y="{POY}" width="{PX}" height="{PX}" '
                    f'image-rendering="pixelated" preserveAspectRatio="xMidYMid meet"/>')
    else:
        s = PX / 40
        rects = "".join(f'<rect x="{POX+x*s:.1f}" y="{POY+y*s:.1f}" width="{s:.1f}" height="{s:.1f}"/>'
                        for x, y in face_fallback(token_id))
        portrait = f'<g fill="{INK}" shape-rendering="crispEdges">{rects}</g>'
    return f'''<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
  <rect width="1000" height="1000" fill="{PAPER}"/>
  <rect x="70" y="952" width="860" height="8" fill="{INK}" fill-opacity=".25"/>
  <g fill="{INK}" fill-opacity=".45">
    <rect x="96" y="938" width="8" height="14"/><rect x="112" y="930" width="8" height="22"/>
    <rect x="128" y="942" width="8" height="10"/>
    <rect x="864" y="938" width="8" height="14"/><rect x="880" y="930" width="8" height="22"/>
    <rect x="896" y="942" width="8" height="10"/>
  </g>
  <path d="{headstone_path()}" fill="{INK}" fill-opacity=".14" stroke="{INK}" stroke-width="14" shape-rendering="crispEdges"/>
  <path d="{headstone_inner_path()}" fill="{PAPER}" stroke="{INK}" stroke-opacity=".35" stroke-width="8" shape-rendering="crispEdges"/>
  <rect x="172" y="868" width="656" height="34" fill="{PAPER}" stroke="{INK}" stroke-width="12" shape-rendering="crispEdges"/>
  <rect x="140" y="896" width="720" height="64" fill="{PAPER}" stroke="{INK}" stroke-width="14" shape-rendering="crispEdges"/>
  {portrait}
  {stone_speckles(token_id)}
</svg>'''

# ----------------------------------------------------------------------
# Routes
# ----------------------------------------------------------------------
@app.get("/health")
def health():
    return {"ok": True, "signer": SIGNER.address, "chainId": CHAIN_ID,
            "cacheEntries": len(_mem)}

@app.get("/memorial/<int:token_id>")
def metadata(token_id):
    if not 0 <= token_id <= 9999: abort(404)
    rec  = burn_record(token_id)
    date = time.strftime("%Y-%m-%d", time.gmtime(rec["timestamp"]))
    return jsonify({
        "name": f"Remembrance \u2014 Normie #{token_id:04d}",
        "description": (f"In memory of Normie #{token_id:04d}, burned on {date}. "
                        "Its portrait remains written into SSTORE2 \u2014 on-chain, forever."),
        "image": f"{PUBLIC_BASE}/memorial/{token_id}/image.svg",
        "attributes": [
            {"trait_type": "Normie",          "value": token_id},
            {"trait_type": "Burned On",       "value": date},
            {"trait_type": "Pixel Count",     "value": rec["pixelCount"]},
            {"trait_type": "Burn Commitment", "value": str(rec["commitId"])},
        ],
    })

@app.get("/memorial/<int:token_id>/image.svg")
def image(token_id):
    if not 0 <= token_id <= 9999: abort(404)
    href = burned_portrait_datauri(token_id)  # retorna None se falhar
    return Response(memorial_svg(token_id, href), mimetype="image/svg+xml",
                    headers={"Cache-Control": "public, max-age=31536000, immutable"})

@app.post("/voucher")
def voucher():
    body = request.get_json(silent=True) or {}
    addr, token_id = body.get("address"), body.get("normieId")
    if not (isinstance(token_id, int) and 0 <= token_id <= 9999): abort(400, "bad normieId")
    if not (isinstance(addr, str) and is_address(addr)):          abort(400, "bad address")
    addr = to_checksum_address(addr)

    rec = burn_record(token_id)
    mourning_end = max(rec["timestamp"], LAUNCH_TIME) + MOURNING
    in_mourning  = time.time() < mourning_end

    if in_mourning and addr != rec["burner"]:
        return jsonify({"error": "mourning period \u2014 only the burner may mint",
                        "burner": rec["burner"], "mourningEndsAt": mourning_end}), 403

    deadline = int(time.time()) + 3600
    msg = {"normieId": token_id, "burner": rec["burner"],
           "burnTimestamp": rec["timestamp"], "deadline": deadline}
    signed = SIGNER.sign_typed_data(
        domain_data={"name": "Normituary", "version": "1",
                     "chainId": CHAIN_ID, "verifyingContract": CONTRACT},
        message_types={"DeathVoucher": [
            {"name": "normieId",      "type": "uint256"},
            {"name": "burner",        "type": "address"},
            {"name": "burnTimestamp", "type": "uint256"},
            {"name": "deadline",      "type": "uint256"},
        ]},
        message_data=msg)
    return jsonify({"voucher": msg,
                    "signature": "0x" + signed.signature.hex().removeprefix("0x"),
                    "phase": "mourning" if in_mourning else "public",
                    "mourningEndsAt": mourning_end})

# ---- cached passthrough so the SITE can use this service as data source ----
_ALLOWED = ("history/", "normie/", "normies/", "holders/", "canvas/", "agents/")

@app.get("/api/<path:sub>")
def passthrough(sub):
    if not sub.startswith(_ALLOWED): abort(404)
    qs = "?" + request.query_string.decode() if request.query_string else ""
    path = "/" + sub + qs
    if sub.endswith((".svg", ".png")):
        data = api_fetch(path, as_text=True)
        mt = "image/svg+xml" if sub.endswith(".svg") else "image/png"
        ttl = YEAR if "/burned/" in path else _ttl_for(path)
        return Response(data, mimetype=mt,
                        headers={"Cache-Control": f"public, max-age={ttl}"})
    return jsonify(api_fetch(path))

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 8090)), debug=True)
