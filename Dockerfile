# syntax=docker/dockerfile:1
# The SWE api: the morphloop SDK server with this app's extension
# (swe.app.create_swe_app). The SDK is a pinned git dependency (pyproject.toml) and
# ships its migrations, applied by `morphloop migrate` on every start.
FROM python:3.13-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
# uv fetches the SDK from git.
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_DEV=1

WORKDIR /app

# Third-party dependencies (and the SDK) first, cached separately from the sources.
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-dev --no-install-project

COPY pyproject.toml uv.lock README.md ./
COPY swe swe
COPY pack pack
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev

FROM python:3.13-slim

WORKDIR /app
COPY --from=builder /app /app

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

CMD ["sh", "-c", "morphloop migrate && uvicorn --factory swe.app:create_swe_app --host 0.0.0.0 --port 8000"]
