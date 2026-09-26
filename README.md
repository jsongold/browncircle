# browncircle

The Software Engineering learning app on the [morphloop](https://github.com/jsongold/morphloop)
SDK: the `lab` and `diagram` artifact types (`swe/`), the SE pack (`pack/`) and the
web UI (`web/`). The app imports the SDK through `harness.sdk` only (plus
`domains.dns` for now; enforced by `.importlinter`).

Requirements: Docker (Compose v2) and [uv](https://docs.astral.sh/uv/). For the
web checks and the E2E also `pnpm` (Node 22).

## Run

From the repo root:

```sh
./scripts/dev.sh up              # real LLM (key from .env.local)
./scripts/dev.sh up --fake-llm   # deterministic fake LLM, no key needed
# api  http://localhost:18xxx  (project morphloop-swe-<hash>)
# web  http://localhost:13xxx
curl -s localhost:18xxx/v2/topics
./scripts/dev.sh logs api        # follow logs (api / web / db)
./scripts/dev.sh down -v         # stop and delete the db volume
```

`up` builds and starts db / api / web and waits until they are healthy. The api
runs `morphloop migrate` (the migrations ship with the SDK) on every start and
loads the SE pack from `pack/` (`MORPHLOOP_PACK_V2_DIR` overrides it); there is no
separate import step. The compose project name and host ports are derived from the
checkout path, so several worktrees can run side by side. Plain
`docker compose up -d --build` works too (ports 8000 / 3000, override with
`API_PORT` / `WEB_PORT`).

The api starts learner lab containers on the host Docker, so it mounts the host
Docker socket: this is a local stack, not a hardened deployment.

## Environment

LLM keys go in `.env.local` (gitignored, never copied into an image), read by the
api on every `up`:

```sh
# .env.local
OPENAI_API_KEY=sk-...
```

| Variable | Where | Meaning |
|---|---|---|
| `OPENAI_API_KEY` (or another litellm key) | `.env.local` | the pack's LLM provider key |
| `MORPHLOOP_LLM_PROVIDER=fake` | shell (`--fake-llm` sets it) | fake LLM, no key; refused when `MORPHLOOP_ENVIRONMENT=production` |
| `DOCKER_HOST` | shell | Docker endpoint for labs, passed through when set |
| `API_PORT` / `WEB_PORT` | shell (`dev.sh` sets them) | host ports |
| `MORPHLOOP_PACK_V2_DIR` | `.env.local` | serve another pack instead of `pack/` |

## E2E

Against a running stack (`--fake-llm`, so the chat steps need no key):

```sh
./scripts/dev.sh up --fake-llm
(cd web && pnpm install && pnpm exec playwright install chromium)   # once
./scripts/dev.sh e2e             # = E2E_BASE_URL=http://localhost:<web-port> pnpm test:e2e
./scripts/dev.sh down -v
```

## Tests and checks

What CI runs (`.github/workflows/ci.yml`):

```sh
uv sync --locked
uv run ruff check . && uv run ruff format --check .
uv run mypy
uv run lint-imports
uv run pytest -q          # tests/e2e starts a postgres container on the local Docker
(cd web && pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm build && pnpm test)
```

The web unit tests read contract fixtures from the installed SDK, so run
`uv sync` first (or set `MORPHLOOP_CONTRACTS_DIR`).

## The SDK dependency

`pyproject.toml` pins `morphloop` to a commit of github.com/jsongold/morphloop. To
move it, change the SHA and run `uv lock`.
