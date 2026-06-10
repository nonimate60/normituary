# normituary

**In memory of the burned Normies — on-chain, forever.**

A community-built memorial for [Normies](https://normies.art) burned through the
NormiesCanvas burn-to-edit mechanic. Every burned Normie leaves its portrait
written into SSTORE2, readable on-chain even after the token is gone. normituary
turns that permanence into a graveyard you can visit — and a Remembrance NFT
you can mint.

<!-- screenshot: replace with a real capture of the site -->
![normituary screenshot](docs/screenshot.png)

## What it does

- **Registry of departures** — every burned Normie, newest first, 12 tombstones
  per page, with its real on-chain portrait, date of death, pixel count and
  burn commitment.
- **Search** — look up any burned Normie by token id (0–9999).
- **Your departed** — connect an EVM wallet and see the Normies *you* burned,
  with per-token and multi-select "pay respects" (memorial mint).
- **Remembrance NFT** (contract included, deployment pending) — hybrid mint:
  - *Mourning period*: 30 days per Normie (from burn or project launch,
    whichever is later). Burner only. Free.
  - *Open remembrance*: after mourning, public mint at 0.01 ETH.
  - One memorial per departed Normie; memorial tokenId = Normie tokenId.

## Repo layout

```
web/        index.html          — the site (single file, no build step)
contracts/  Normituary.sol      — ERC-721 memorial, EIP-712 death vouchers
infra/      normies-proxy.conf  — nginx caching proxy for api.normies.art
            setup-proxy.sh      — idempotent VPS installer
```

## Running the site

No build step. Open `web/index.html` in a browser, or serve it statically:

```bash
cd web && python3 -m http.server 3000
```

The site auto-detects its data source: it tries the VPS cache proxy first and
falls back to `https://api.normies.art` directly. The status line above the
registry tells you which source is live (or that you are in demo mode).

## The cache proxy

The official API is free but rate-limited (60 req/min/IP) and the proxy adds
CORS, collapses concurrent requests (`proxy_cache_lock`) and serves stale data
if the upstream is down. TTLs follow the nature of the data — the dead never
change, so burned images are cached for a year:

| Endpoint                         | TTL  | Why                          |
| -------------------------------- | ---- | ---------------------------- |
| `/history/burned/*`              | 365d | the departed are immutable   |
| `/history/burns/{id}`            | 1h   | commits are final after reveal |
| `/history/burns`, `/stats`, ...  | 30s  | live lists and counters      |
| `/normie/*`, `/agents/*`         | 5m   | canvas edits can change them |
| `/holders/*`, `/canvas/*`        | 60s  | ownership moves              |

Deploy:

```bash
scp infra/normies-proxy.conf infra/setup-proxy.sh root@YOUR_VPS:/root/
ssh root@YOUR_VPS 'bash /root/setup-proxy.sh'
```

For HTTPS (required once the site itself is served over https), point a
subdomain at the VPS and run `certbot --nginx` — instructions are printed at
the end of the setup script.

## The contract

`contracts/Normituary.sol` — OpenZeppelin ERC-721 + EIP-712. Burns are proven
with a signed `DeathVoucher(normieId, burner, burnTimestamp, deadline)` issued
by a backend that verifies the burn against the official history endpoints
(revealed, not expired) before signing. The contract decides mourning vs.
public phase on-chain from the burn timestamp.

Status: **not yet deployed**. The site's "pay respects" buttons are explicit
stubs until the contract is live on testnet and the voucher backend exists.

## Roadmap

- [x] Live site with registry, search, wallet section
- [x] VPS cache proxy
- [ ] Voucher-signing backend (Flask)
- [ ] Sepolia deployment + ethers.js mint flow
- [ ] On-chain SVG memorial renderer
- [ ] Commit detail pages (the "siblings" burned together)

## Data sources

All data comes from the public [Normies API](https://api.normies.art) and the
Ethereum mainnet contracts it indexes, notably NormiesCanvas
(`0x64951d92e345C50381267380e2975f66810E869c`). No API key required.

## License

[CC0 1.0](LICENSE) — same spirit as the Normies ecosystem. Use it, fork it,
bury your own.
