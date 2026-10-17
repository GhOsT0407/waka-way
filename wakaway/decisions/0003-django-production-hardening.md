
# 0003 — Gate Django HTTPS/cookie hardening behind `DEBUG=False`

**Date:** 2026-07-02
**Status:** Decided, applied

## Context

`settings.py` had no `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, or HSTS settings at all. Initially flagged this alongside the committed `.env` having `DEBUG=True`, assuming that `.env` might be what's deployed to Railway. Verified with `git ls-files`/`git check-ignore` that both `client/.env` and `server/backend/.env` are gitignored and untracked — so the committed `.env`'s `DEBUG=True` is local-dev-only and never reaches a git-based Railway build. That part turned out not to be a real issue; didn't touch `.env`.

## Decision

Added HTTPS/cookie/HSTS settings to `settings.py`, gated behind `if not DEBUG:`, including `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')` since Railway (and similar PaaS) terminate TLS at the edge and forward plain HTTP — without that header, `SECURE_SSL_REDIRECT` would cause a redirect loop.

## Why

Pure defensive code: activates automatically whenever `DEBUG` is genuinely `False` in a real deployment (assuming Railway has its own dashboard-configured env vars, which is the standard pattern), without touching any secret values. Zero risk of breaking local dev, since `DEBUG=(bool, False)` is already the settings.py default and local `.env` explicitly sets it `True`.

## Affected files
- `server/backend/backend/settings.py`
- [[Backend API]]
