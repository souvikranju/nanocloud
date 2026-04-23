# CHANGELOG — Code Review Fixes

All changes below were made in response to the full-stack code review.
Login/authentication is tracked separately and not included here.

---

## PHP Backend

---

### `src/Core/Config.php`

**Fix: `get_defined_vars()` scope pollution**

- **What changed:** Replaced two bare `require` + `get_defined_vars()` calls
  with isolated anonymous static functions (IIFEs).
- **Why:** `get_defined_vars()` captures every variable in the calling scope at
  the time it is invoked. The original code ran inside `Config::load()`, so the
  local variables `$configDir` and `$localConfig` were included in `self::$config`.
  Any code calling `Config::get('configDir')` would silently receive the path to
  the config directory — an unintentional information exposure. The merge of local
  overrides had the same problem, additionally polluting the config with a key
  named `overrides`. The IIFE pattern ensures the only variables in scope during
  `get_defined_vars()` are those explicitly defined inside `defaults.php` /
  `local.php`.

---

### `public/download.php`

**Fix 1: HTML, JS, and CSS files served inline — stored XSS vector**

- **What changed:** Removed `'html'`, `'htm'`, `'js'`, and `'css'` from the
  `$inlineTextExts` list (formerly `$textExts`) in `shouldStreamInBrowser()`.
  These extensions now fall through to the default `return false`, forcing the
  browser to download them as attachments.
- **Why:** With `Content-Disposition: inline` and a MIME type of `text/html` or
  `application/javascript`, the browser executes the file in the application's
  origin. Any user who could upload an `.html` file containing
  `<script>document.location='...'</script>` would have a stored XSS payload
  served from the same origin as the app, bypassing same-origin policy. Safe
  inline text types (`txt`, `json`, `xml`, `md`) are unaffected.

**Fix 2: `addslashes()` unsafe for HTTP header filename encoding**

- **What changed:** Replaced
  `'Content-Disposition: ' . $disposition . '; filename="' . addslashes($name) . '"'`
  with RFC 5987 encoding:
  `"Content-Disposition: {$disposition}; filename*=UTF-8''" . rawurlencode($name)`
- **Why:** `addslashes()` escapes `"` as `\"` which is not a valid mechanism for
  HTTP headers per RFC 6266. Filenames containing `\r\n` could inject additional
  headers on PHP versions without header-injection hardening. Non-ASCII filenames
  (e.g., `фото.jpg`) would be corrupted. `rawurlencode()` with `filename*` is the
  correct, standards-compliant approach and handles all characters safely.

**Fix 3: Missing `X-Content-Type-Options: nosniff` header**

- **What changed:** Added `header('X-Content-Type-Options: nosniff')` before any
  output.
- **Why:** Without this header browsers may MIME-sniff the content type. A
  binary file reported as `application/octet-stream` could be re-interpreted as
  HTML and executed. `nosniff` locks the browser to the declared `Content-Type`.

---

### `public/api.php`

**Fix 1: Exception messages expose internal paths**

- **What changed:** Changed the catch block from
  `Response::serverError('Server error: ' . $e->getMessage())` to logging the
  exception internally via `error_log()` and returning a generic
  `'An internal error occurred. Please try again.'`.
- **Why:** PHP exception messages routinely contain absolute file paths
  (e.g., `/var/www/html/src/Services/...`), class names, and argument values.
  Exposing this information helps attackers map the server's internal layout. The
  full trace is preserved in the server error log for debugging.

**Fix 2: Action parameter sourced from `$_REQUEST` (includes cookies)**

- **What changed:** Changed `Request::input('action', 'list')` to
  `Request::get('action', 'list')`.
- **Why:** `$_REQUEST` merges `$_GET`, `$_POST`, and `$_COOKIE`. A browser
  cookie named `action` would override the query parameter, allowing session-
  scoped manipulation of which handler is invoked. The action is always sent as a
  query-string parameter; reading only from `$_GET` removes the cookie attack
  surface.

**Fix 3: Write operations accept GET requests**

- **What changed:** Added an explicit HTTP method guard that returns HTTP 405 for
  all write actions (`upload`, `delete`, `rename_file`, etc.) when the request
  method is not `POST`.
- **Why:** Although the handlers read POST body parameters (which would just be
  empty on a GET request, causing graceful validation failures), accepting GETs
  for write operations violates REST semantics, makes CSRF pre-flight analysis
  harder, and creates ambiguity for caching proxies. Enforcing POST explicitly
  makes the API contract clear and provides a documented rejection path.

---

### `public/update_api.php`

**Fix: `--exclude` arguments not shell-escaped**

- **What changed:** Replaced
  `fn($path) => "--exclude='{$path}'"` with
  `fn($path) => '--exclude=' . escapeshellarg($path)`.
- **Why:** Interpolating values directly into shell argument strings is
  injection-unsafe. A path containing a single quote, space, or shell
  metacharacter (`$`, `` ` ``, `!`) would break the command or enable arbitrary
  command injection. Although `$PRESERVE_PATHS` is currently hardcoded, the
  pattern was unsafe and would become a real vulnerability the moment a dynamic
  value was introduced. `escapeshellarg()` is the correct defensive primitive.

---

### `src/Services/UploadService.php`

**Fix 1: Disk-space check performed after directory creation**

- **What changed:** The shared `prepareDestination()` helper (see Fix 3) now
  checks `hasEnoughSpace()` before calling `ensureDirectoryExists()`.
- **Why:** In the original `processFile()`, directories were created first and
  then the disk-space check was performed. If the disk was nearly full, the
  operation would return an error but leave orphan empty directories in the
  storage tree, cluttering the file listing and wasting inodes.

**Fix 2: No disk-space check before saving individual chunks**

- **What changed:** Added a per-chunk disk-space check at the top of
  `handleChunk()`, using the `size` field from `$_FILES['chunk']`.
- **Why:** A chunked upload for a very large file could fill the disk entirely
  with `.part` files, with the insufficient-space error only surfacing at merge
  time (too late to prevent damage). The per-chunk check gates each chunk write
  individually, failing fast with a clear error message before disk space is
  consumed.

**Fix 3: Duplicated validation pipeline extracted to `prepareDestination()`**

- **What changed:** The identical sequence of (1) path sanitization, (2)
  disk-space check, (3) duplicate detection, (4) nested directory creation, and
  (5) storage-root boundary verification was extracted from both `processFile()`
  and `mergeChunks()` into a private `prepareDestination()` method.
- **Why:** The duplication was ~50 lines repeated verbatim. Any future change to
  validation logic (e.g., adding a new check) required updating two places. The
  refactor eliminates the drift risk and makes `processFile()` and
  `mergeChunks()` significantly shorter and easier to read.

---

### `src/Helpers/functions.php`

**Fix: `formatBytes()` type hint and negative-number guard**

- **What changed:** Changed parameter type from `int $bytes` to `int|float $bytes`
  and added `$bytes = max(0.0, (float)$bytes)` at the top of the function.
- **Why:** After the first division (`$bytes /= 1024`), the value becomes a
  `float`. PHP 8's strict type system would coerce this at the call site in some
  contexts but the declared type was misleading. Additionally, passing a negative
  byte count (e.g., from a filesystem edge case) would produce nonsensical output
  like `"-1 KB"`. The guard clamps to `0`.

---

## JavaScript Frontend

---

### `public/assets/js/nanocloudClient.js`

**Fix 1: `uploadChunked` used `new Promise(async ...)` antipattern**

- **What changed:** Rewrote `uploadChunked` from
  `export function uploadChunked(...) { return new Promise(async (resolve, reject) => {...}) }`
  to `export async function uploadChunked(...)`.
- **Why:** Wrapping an `async` function inside `new Promise()` is an established
  antipattern. If the async body throws an error _before_ the first `resolve` or
  `reject` call, the error is swallowed and the returned promise hangs forever,
  leaving the upload UI in a permanent loading state with no error shown. As a
  plain `async` function, any thrown error propagates as a rejection automatically.
  The refactor also eliminated the fragile pattern of calling `resolve()` inside a
  `for` loop body without returning.

**Fix 2: `await generateUploadId(...)` on a synchronous function**

- **What changed:** Removed `await` from the `generateUploadId()` call.
- **Why:** `generateUploadId()` is a pure synchronous function returning a
  string. Awaiting it creates an unnecessary microtask tick and misleads readers
  into thinking it performs I/O. The `await` keyword on a non-Promise value is
  harmless but creates false expectations about the function's contract.

**Fix 3: `checkUploadStatus()` used XHR unnecessarily**

- **What changed:** Replaced the ~25-line XHR wrapper with a single
  `return postForm(form)` call using the existing `fetch`-based helper.
- **Why:** The XHR path was only justified for operations that need upload
  progress events (which `checkUploadStatus` does not). The verbose XHR boilerplate
  was a maintenance burden and inconsistent with all other non-upload API calls.

**Fix 4: No request timeout on `fetch()` or XHR**

- **What changed:** Added `signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)` to
  all `fetch()` calls and `xhr.timeout = REQUEST_TIMEOUT_MS` to all XHR requests.
- **Why:** Without a timeout, a hanging server response (e.g., network partition,
  slow disk I/O) causes the entire UI to freeze indefinitely in a loading state
  with no recovery path for the user. The 30-second default matches typical
  browser expectations for interactive requests.

---

### `public/assets/js/uploader.js`

**Fix: Progress panel auto-hides even when uploads fail**

- **What changed:** The `setTimeout` that clears and hides the progress panel is
  now only scheduled when all uploads in the batch succeeded. On partial or full
  failure, the panel stays visible and the FAB is re-shown without clearing.
- **Why:** The 5-second auto-hide would clear per-file error indicators before
  users with slower reading speeds could see them. Errors are already shown via
  toast notifications, but the progress panel provides file-by-file detail.
  Keeping it open on failure gives the user time to understand which specific
  files failed and why.

---

### `public/assets/js/ui/list.js`

**Fix 1: XSS via `innerHTML` with server-provided breadcrumb parts**

- **What changed:** Added an `escHtml()` function and applied it to both the
  `data-path` attribute value and the visible text content in
  `createClickableBreadcrumb()`.
- **Why:** `item.breadcrumbs` arrives from the server response. While the PHP
  `normalizePath()` sanitizer provides defense at the source, a defense-in-depth
  approach requires the client to also escape HTML before inserting server-provided
  strings into `innerHTML`. A folder named `<img onerror=...>` would have executed
  script in the user's browser without this fix.

**Fix 2: XSS via `innerHTML` with current path in search result headers**

- **What changed:** Replaced the `header.innerHTML = \`...${getCurrentPath()}...\``
  template literals in `renderNormalItems()` and `renderDeepSearchResults()` with
  DOM API construction (`createElement`, `textContent` assignment).
- **Why:** `getCurrentPath()` returns a string derived from `resp.path` in the
  server response. Template-literal interpolation into `innerHTML` without escaping
  is an XSS sink. `textContent` is inherently safe and is the correct API for
  inserting dynamic plain-text content.

**Fix 3: Inline disabled styles replaced with CSS class**

- **What changed:** Replaced `element.style.opacity = '0.5'; element.style.cursor = 'not-allowed'`
  with `element.classList.toggle('btn--disabled', condition)` across
  `createDeleteButton()`, `updateSelectionButtonStates()`, and
  `updateMoveButtonState()`. Added `.btn--disabled` to `components.css`.
- **Why:** Inline styles override the entire CSS cascade and cannot be overridden
  by theme or component styles without `!important`. A CSS class is the idiomatic
  mechanism for representing UI state, is easier to override in themes, and keeps
  styling concerns in the stylesheet rather than scattered through JS.

---

### `public/assets/js/ui/itemActions.js`

**Fix 1: `itemName` ReferenceError in bulk-delete catch block**

- **What changed:** Moved `const itemName = item.name` from inside the `try {}`
  block to immediately before it in the `deleteSelectedItems()` for loop.
- **Why:** `const` declarations are block-scoped. Declaring `itemName` inside
  `try {}` made it invisible in the paired `catch {}` handler. When a delete
  operation failed (network error, permission denied, etc.), the catch block threw
  `ReferenceError: itemName is not defined`, which was itself caught by the outer
  error handler, producing a confusing `Error deleting "undefined"` message. This
  is an active bug that silently discards the actual error detail on every bulk-
  delete failure.

**Fix 2: Unsanitized error messages via `innerHTML`**

- **What changed:** Replaced
  `renameModalMessages.innerHTML = '<div class="...">Error: ${err.message}</div>'`
  with `replaceChildren()` using `createElement` + `textContent`.
- **Why:** `err.message` can contain server-side error strings which may include
  HTML (e.g., the server returns `<b>File not found</b>`). Inserting these via
  `innerHTML` would render the HTML, and a carefully crafted error message could
  execute script. `textContent` treats all content as plain text.

---

### `public/assets/js/ui/filterSort.js`

**Fix 1: Conflicting localStorage key for view mode**

- **What changed:** Removed `setViewMode()`, `setupViewModeHandlers()`, and
  `updateViewModeButtonStates()` entirely from `filterSort.js`. Removed the call
  to `setupViewModeHandlers()` from `initFilterSort()`.
- **Why:** `filterSort.js` was writing view-mode preference to localStorage under
  the key `'nanocloud_view_mode'`, while `list.js` reads and writes the preference
  under `VIEW_MODE_STORAGE_KEY = 'nanocloud-view-mode'` (hyphen vs underscore).
  Changes made via `filterSort`'s buttons were ignored by `list.js` on the next
  load. Additionally, `list.js` registers its click handlers with
  `useCapture: true` + `stopImmediatePropagation()`, meaning `filterSort`'s
  bubble-phase listeners _never executed_ at runtime — making them dead code.
  View-mode management is now owned exclusively by `list.js`.

**Fix 2: `window.*` globals replaced with injected callbacks**

- **What changed:** Added exported setter functions `setFilterSortCallback()`,
  `setHideSearchModalCallback()`, and `setToastCallbacks()`. All internal calls to
  `window.filterSortCallback()`, `window.hideSearchModal()`, `window.showError()`,
  and `window.showInfo()` were replaced with calls to the corresponding
  module-level variables set by these setters.
- **Why:** Global `window.*` assignments create invisible cross-module coupling.
  Any module can overwrite or read these globals, making the dependency graph
  opaque and breaking testability (tests need a DOM to exercise `window`). Explicit
  injected callbacks make the dependencies visible at the call sites, can be mocked
  in isolation, and don't pollute the global namespace.

---

### `public/assets/js/main.js`

**Fix 1: `webkitdirectory = true` blocked individual file selection**

- **What changed:** The single `hiddenFileInput` with `webkitdirectory = true`
  was replaced with two inputs: `hiddenFileInput` (no `webkitdirectory`, for
  individual file selection) and `hiddenFolderInput` (with `webkitdirectory`, for
  folder selection). Elements with `data-action="select-folder"` trigger the
  folder input; the drop area click triggers the file input.
- **Why:** Setting `webkitdirectory` on a file input causes the native picker to
  show only directories, making it impossible to select individual files via the
  "Click to select" path in the upload modal. Users would have to drag-and-drop
  individual files — the click path was entirely non-functional for its stated
  purpose.

**Fix 2: Double fetch on shared-folder deep-links**

- **What changed:** Removed the `handleHashNavigation()` call after
  `initializeApp()`. The `setCurrentPath(sharedPath)` call inside
  `initializeApp()` already ensures `fetchAndRenderList()` fetches the correct
  initial path. `handleHashNavigation()` was therefore a no-op in the happy path
  and a redundant API call in edge cases.
- **Why:** With both `setCurrentPath()` (inside `initializeApp()`) and
  `setCurrentPathWithRefresh()` (inside `handleHashNavigation()`) executing for
  `#path=` links, the app issued two sequential `list` API calls for the same path.
  The second was debounced out in practice, but the code logic was confusing and
  created a latent bug if the debounce window was ever reduced.

**Fix 3: `window.*` global assignments removed**

- **What changed:** Removed `window.showError = showError`, `window.showInfo = showInfo`,
  `window.showSuccess = showSuccess`, and `window.hideSearchModal = hideSearchModal`.
  Replaced with calls to the new setters exported from `filterSort.js`:
  `setToastCallbacks({ showError, showInfo })` and
  `setHideSearchModalCallback(hideSearchModal)`.
- **Why:** Global property assignments on `window` are namespace pollution.
  They make it impossible to tree-shake the toast module, create surprising
  re-entrancy if any third-party script redefines these names, and make unit
  testing require a full DOM environment.

**Fix 4: Hardcoded fallback version string `'v2.0'`**

- **What changed:** The `'v2.0'` fallback in `initializeUpdateChecker()`'s catch
  block was replaced with `'unknown'`, and the assignment is guarded so it only
  fires if the element has no existing text content.
- **Why:** The application was at version 3.0 when this string read `'v2.0'`.
  A hardcoded version string in a catch block will always be wrong eventually.
  Displaying `'unknown'` is honest; the element is already empty before the catch
  fires.

---

### `public/assets/js/state.js`

**Fix 1: `console.log` in production-path code**

- **What changed:** Removed the three `console.log` calls inside
  `requestRefresh()` (`'not refreshing now - too soon'`, `'Starting refresh'`,
  `'Clearing pending refresh'`).
- **Why:** These were debugging aids leftover from development. In production they
  generate noise in every user's browser DevTools console, triggered on every
  directory navigation and file operation — potentially hundreds of log entries per
  session.

**Fix 2: Dead `pendingRefresh` state variable**

- **What changed:** Removed the `pendingRefresh` variable declaration and all
  assignments to it (`pendingRefresh = true`, `pendingRefresh = false`). Removed
  the `setTimeout` finally block whose sole purpose was clearing the flag.
- **Why:** `pendingRefresh` was set to `true` before every refresh call and then
  cleared after a debounce interval, but the value was never _read_ anywhere in
  the codebase to gate or modify behavior. It was dead state that added cognitive
  overhead (readers expected it to control something) and a `setTimeout` that fired
  on every refresh for no effect.

---

## CSS

### `public/assets/css/components.css`

**Added `.btn--disabled` class**

- **What changed:** Extended the existing `.btn:disabled` rule to also match
  `.btn--disabled`.
- **Why:** JavaScript modules now toggle `classList` with `btn--disabled` rather
  than setting inline styles. The class provides the same visual treatment (`opacity: 0.5`,
  `cursor: not-allowed`) without inline-style specificity issues.

---

## Tests

New files under `tests/`:

| File | What it covers |
|------|---------------|
| `tests/php/ConfigTest.php` | Config scope isolation, get/set, auto-load |
| `tests/php/SecurityTest.php` | PathValidator, Sanitizer, formatBytes edge cases |
| `tests/php/UploadServiceTest.php` | prepareDestination logic, disk-check ordering, traversal safety |
| `tests/php/DownloadTest.php` | shouldStreamInBrowser (XSS fix), RFC 5987 encoding, nosniff |
| `tests/js/nanocloudClient.test.js` | generateUploadId determinism, fetch options, async pattern |
| `tests/js/itemActions.test.js` | itemName scope fix, delete error reporting |
| `tests/js/xss.test.js` | escHtml() coverage, breadcrumb XSS neutralisation |
| `tests/run_php_tests.php` | PHP test runner |
| `tests/run_js_tests.mjs` | JS test runner |

Run PHP tests:  `php tests/run_php_tests.php`
Run JS tests:   `node tests/run_js_tests.mjs`  (requires Node.js 20+)
