# Privacy & data retention

Customers type home addresses. The system is designed so that we hold as little as possible.
`/privacy` in the app is a plain-language summary and is a **placeholder, not a reviewed
legal policy**.

## What is stored, where, for how long

| Data | Stored? | Where | Retention |
|---|---|---|---|
| Search text / address | No | In-memory geocode cache (10 min) | Never on disk, never logged |
| Design while editing | Browser only | `localStorage` (`maploom-studio-v1`) | Until the customer clears it / starts over |
| Geography job input (frame centre) | Yes, encrypted | `jobs.input_enc` | Deleted 24 h after the job finishes |
| Geography snapshot | Yes | Disk, content-addressed | 30 days unless a saved project needs it |
| Saved design + place label | Only after **Save** | `design_versions.design_enc`, `projects.location_enc` (AES-256-GCM) | Until the customer deletes it |
| Export files | Yes | Disk | 24 h, signed expiring links |
| Identity | Anonymous cookie; only its SHA-256 hash is stored | `ml_guest` (httpOnly, SameSite=Lax) | 1 year / until "Delete everything" |

## Controls in the code

- **Explicit save** — `saveProject` is the only writer of designs.
- **No address in URLs** — full-text search is a POST; type-ahead queries are in the query
  string of a same-origin request and are not logged by the app. (A reverse proxy in front
  must be configured not to log query strings for `/api/geocode/suggest`.)
- **Logging** — structured logger redacts known-sensitive keys (`query`, `address`, `lat`,
  `lon`, `design`, …); geocoder errors never include the request URL. Tested.
- **Deletion** — per project (`DELETE /api/projects/:id`, cascades to versions) and
  everything (`DELETE /api/me`: projects, exports, jobs, cookie).
- **Retention sweep** — `purgeExpired()` (hourly in the worker; on demand from admin).
- **Admin** — sees ids, styles, statuses and counts; never decrypted designs or places.
- **Security** — env validation, parameterised SQL only, zod validation on every input,
  same-origin check on mutating requests (CSRF), CSP and frame denial, per-client rate
  limits, signed download URLs, server-computed prices, friendly errors without internals.

## Known gaps before launch

- The snapshot key is a capability: anyone holding the 96-bit key can fetch that snapshot.
- Rate limits are per-process memory (need Redis when scaled out).
- Key rotation for `APP_SECRET` is not implemented.
- The encryption protects data at rest; an operator with `APP_SECRET` can decrypt.
- No accounts yet, so a saved map cannot be recovered from another browser.
- Legal review of the privacy policy, ODbL attribution wording on physical goods, and
  children's-product rules (CPSIA) for play mats is outstanding.
