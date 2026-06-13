# normituary — INSTALL (Railway edition, sem VPS)

Arquitetura final:
- **Site** (Vite + RainbowKit/wagmi) — serviço Railway que já existe
- **Backend** (Flask: renderer + voucher + proxy cacheado) — NOVO serviço Railway, mesmo repo
- **Contrato** — Sepolia primeiro, mainnet depois
- HTTPS automático nos dois serviços. Sem nginx, sem certbot, sem mixed content.

---

## PASSO 1 — Gerar o signer (na sua máquina, 2 min)

Na pasta do projeto Vite (o viem já está instalado via wagmi):

```powershell
node -e "const {generatePrivateKey, privateKeyToAccount} = require('viem/accounts'); const k = generatePrivateKey(); console.log('SIGNER_ADDRESS =', privateKeyToAccount(k).address); console.log('SIGNER_KEY     =', k)"
```

- **SIGNER_ADDRESS** → vai pro construtor do contrato (passo 2)
- **SIGNER_KEY** → vai SÓ pras Variables do Railway (passo 3). Não salva em
  arquivo, não commita, não cola em mais nada. Fecha o terminal depois.

---

## PASSO 2 — Contrato na Sepolia via Remix (15 min)

1. MetaMask na rede Sepolia + ETH de faucet
   (cloud.google.com/application/web3/faucet/ethereum/sepolia)
2. remix.ethereum.org → cola `contracts/Normituary.sol` do repo
3. Compiler `0.8.20`+ → Compile
4. Deploy & Run → **Injected Provider - MetaMask** (confere: Sepolia)
5. Argumentos do construtor:
   - `_SIGNER`  → SIGNER_ADDRESS do passo 1
   - `BASEURI_` → placeholder `https://backend.up.railway.app/memorial/`
     (corrige depois com `setBaseURI` quando souber a URL real)
6. Deploy → confirma → **anota o endereço do contrato**
7. Clica em `launchTime` no painel → **anota o número**
8. (Recomendado) Verifica em sepolia.etherscan.io

---

## PASSO 3 — Backend como 2º serviço no Railway (10 min)

### 3.1 Adicionar a pasta ao repo
Descompacta `normituary-backend-railway.zip` → pasta `backend/` na raiz
do repo (junto de `web/`, `contracts/`) → commit + push.

```
normituary/
├── backend/          <- NOVO
│   ├── app.py
│   ├── requirements.txt
│   ├── railway.json
│   └── .env.example
├── contracts/
├── web/  (ou src/ do Vite)
└── ...
```

### 3.2 Criar o serviço
1. Railway → seu projeto → **+ New** → **GitHub Repo** → mesmo repositório
2. No serviço novo → **Settings** → **Root Directory** = `/backend`
   (Railpack detecta Python pelo requirements.txt; o start command vem
   do `railway.json`: gunicorn)
3. **Settings → Networking → Generate Domain** → anota a URL
   (ex.: `normituary-backend-production.up.railway.app`)

### 3.3 Variables (Settings → Variables do serviço backend)
```
SIGNER_KEY        = 0x...                          (passo 1)
CONTRACT_ADDRESS  = 0x...                          (passo 2.6)
CHAIN_ID          = 11155111
LAUNCH_TIME       = <número do passo 2.7>
PUBLIC_BASE       = https://<url-do-backend>.up.railway.app
ALLOWED_ORIGINS   = https://<url-do-site>.up.railway.app,http://localhost:5173
```
Salvar → o serviço redeploya sozinho.

### 3.4 Testar (navegador ou curl)
```
https://<backend>/health
  -> {"ok": true, "signer": "0x...", ...}  (signer deve bater com o passo 1)

https://<backend>/memorial/<id-de-um-normie-queimado>/image.svg
  -> a lápide com retrato real

https://<backend>/api/history/stats
  -> contadores ao vivo (proxy cacheado funcionando)
```

### 3.5 Corrigir o baseURI do contrato
Remix (ou Etherscan → Write Contract) com a wallet owner:
`setBaseURI("https://<url-real-do-backend>/memorial/")`

---

## PASSO 4 — Front Vite (30 min)

### 4.1 Variables
`.env.local` (dev) e no serviço do SITE no Railway:
```
VITE_BACKEND_URL=https://<backend>.up.railway.app
VITE_NORMITUARY_ADDRESS=0x...
```

### 4.2 Fonte de dados do site
Troque as chamadas diretas a `https://api.normies.art/...` por
`${VITE_BACKEND_URL}/api/...` — mesmo path, agora com cache e CORS
garantidos (ex.: `/api/history/burns?limit=20`).

### 4.3 ABI + hook
`src/lib/normituary.ts` e `src/hooks/usePayRespects.ts` — código completo
no INSTALL.md anterior, seções 4.2 e 4.3 (inalterado: o backend devolve o
mesmo shape `{voucher, signature, phase}`).

### 4.4 Botões
Liga `payRespects(tokenId)` nos botões individual e selected
(selected: sequencial por enquanto — batch mint fica pra v2 do contrato).

### 4.5 Chains
`sepolia` incluída no config do wagmi/RainbowKit.

### 4.6 Commit + push → os DOIS serviços redeployam.

---

## PASSO 5 — Teste E2E na Sepolia

1. Site em produção → conecta wallet (mobile via WalletConnect também!)
2. pay respects num Normie queimado:
   - se sua wallet É a queimadora e está em luto → mintAsMourner, grátis
   - se NÃO é → backend responde 403 com mourningEndsAt (comportamento certo)
   - pós-luto → mintPublic 0.02 ETH (lembrete: logo após o deploy TODOS
     estão em luto, pois conta max(burn, launchTime) + 30d)
3. Confirma a tx → sepolia.etherscan.io → Transactions do contrato
4. testnets.opensea.io → contrato → a lápide renderizando no marketplace
5. Mint duplicado do mesmo id deve reverter

---

## PASSO 6 — Mainnet

1. Redeploy Remix na mainnet (⚠️ launchTime real = largada dos 30 dias
   de luto dos OGs — alinhar com o anúncio)
2. Variables do backend: `CHAIN_ID=1`, novo `CONTRACT_ADDRESS`,
   novo `LAUNCH_TIME` → redeploy automático
3. `VITE_NORMITUARY_ADDRESS` novo no serviço do site
4. `setBaseURI` no contrato mainnet
5. Verificação no Etherscan → anúncio (X + hackathon.normies.art + Reel)

---

## Notas de operação

- **Cache do backend é em memória + /tmp**: zera a cada redeploy. Sem
  problema — repopula sozinho; o rate limit da NormiesAPI (60/min) só
  seria risco com tráfego alto exatamente após um deploy.
- **Custo Railway**: o backend é leve (2 workers gunicorn); cabe no
  plano Hobby junto com o site.
- **Se um dia voltar a ter VPS**: o pacote nginx anterior continua válido
  — é só apontar `NORMIES_API` do backend pro proxy e ganhar cache em disco.
- **Segurança do signer**: a chave vive nas Variables do Railway
  (criptografadas). Pra mainnet com volume, considere migrar pra um
  secret manager ou VPS dedicado. Pro lançamento, está adequado.

## Checklist

- [ ] Signer gerado, chave só no Railway Variables
- [ ] Contrato Sepolia deployado + verificado, launchTime anotado
- [ ] backend/ no repo, serviço criado, Root Directory=/backend
- [ ] /health ok com o signer correto
- [ ] /memorial/{id}/image.svg com retrato real
- [ ] /api/history/stats respondendo
- [ ] setBaseURI com a URL real
- [ ] Front: env vars, dados via /api, hook ligado
- [ ] E2E Sepolia ok no Etherscan + OpenSea testnet
- [ ] Mainnet + anúncio
