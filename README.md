# NanoCloud

A minimal, fast, self-hosted cloud server designed to run on low-power hardware (e.g., Raspberry Pi). NanoCloud provides a simple PHP-powered web frontend for browsing, uploading, downloading, and deleting files/folders on a trusted private network. Common file types are stream-able on browser.

Tested environment: Raspberry Pi (Raspberry Pi OS) with lighttpd and PHP 8.4.

## Key Features

- Small and fast:
  - Runs on minimal hardware such as Raspberry Pi.
  - No heavy frameworks or databases.
- Pure PHP server:
  - Requires only a PHP-capable setup (fastcgi + PHP-FPM).
- Simple web UI:
  - Browse files and folders.
  - View or download files.
  - Upload files.
  - Create folders.
  - Delete files/folders.
- Trusted LAN operation:
  - Designed for home/private networks where all users are trusted.
  - No authentication by default.

## Project Structure

```
.
├─ index.php                   # Frontend entry point
├─ nanocloud_api.php           # File/Folder operations API
├─ nanocloud_download.php      # Stream files to client
├─ config.php                  # Configuration (paths, limits)
├─ nanocloud_lib.php           # Shared helpers/utility functions
├─ assets/
│  ├─ style.css                # UI styles
│  └─ js/
│     ├─ main.js               # Entrypoint: boot + DOM wiring
│     ├─ nanocloudClient.js    # Fetch/XHR wrappers for API endpoints
│     ├─ state.js              # Centralized client state and constants
│     ├─ uploader.js           # Orchestrated uploads with concurrency and progress
│     ├─ utils.js              # Pure helper functions
│     └─ ui/
│        ├─ messages.js        # Global and modal notifications
│        ├─ progress.js        # Upload progress panel: show/hide, per-file items
│        └─ list.js            # Rendering of files/dirs, breadcrumbs, storage meter
```

## Upload Flow

1. Files selected via modal or dropped into a drop area
2. `uploader.js` validates against server limits and duplicates using `state.js`
3. UI progress items are created via `ui/progress.js`
4. Files are uploaded concurrently (default limit: 3) using `uploadSingle`
5. Progress updates via XHR events; each item marks complete or error
6. Listing is refreshed once at the end (`ui/list.js`)
7. Progress panel hides after a short delay, FAB reappears

## Installation

1. Requirements:
   - Server (Ex: lighttpd).
   - PHP and PHP-FPM.

2. Deploy:
   - Copy the repository files to your document root (e.g., `/var/www/nanocloud`).
   - Ensure the webserver user (e.g., `www-data`) has read/write permissions to the storage path configured in `config.php`.

3. Run:
   - Start/enable PHP-FPM and lighttpd services.
   - Open the NanoCloud host in your browser on your LAN.

## Configuration

Configuration is primarily in `config.php` plus PHP ini settings and lighttpd settings.

### Application configuration (`config.php`)

Typical values (names are representative and may be adjusted in your install):

- `STORAGE_ROOT`: Absolute path to the directory NanoCloud exposes (e.g., `/home/pi/FTP/dropbox`).
- `MAX_UPLOAD_BYTES`: Upper bound for per-file uploads (ensure it matches PHP limits below).

### PHP configuration (`php.ini`)

Ensure PHP allows uploads large enough for your needs:

- `file_uploads = On`
- `upload_max_filesize = 256M`    # Adjust to your needs
- `post_max_size = 256M`          # Must be >= upload_max_filesize
- `memory_limit = 512M`           # Ensure enough memory for processing
- `max_file_uploads = 50`         # Optional: number of files per request
- `max_execution_time = 60`       # Optional: tune based on hardware/network

If using PHP-FPM, confirm the pool settings (e.g., `pm`, `pm.max_children`) suit your hardware (Raspberry Pi) capacity.

Restart PHP-FPM after changes:
```
sudo systemctl restart php8.4-fpm
```

### lighttpd configuration

Example `lighttpd.conf` adjustments:
```
server.document-root = "/var/www/nanocloud"
index-file.names = ("index.php")

# Modules
server.modules += ( "mod_fastcgi" )

# Upload handling (adjust paths/limits to your needs)
server.upload-dirs = ( "/var/cache/lighttpd/uploads" )
server.max-request-size = 268435456   # 256 MiB in bytes

# FastCGI + PHP-FPM socket (verify your actual socket path)
fastcgi.server = ( ".php" =>
  ((
    "socket" => "/run/php/php-fpm.sock",
    "broken-scriptfilename" => "enable"
  ))
)
```

Notes:
- The PHP-FPM socket path may be `/run/php/php8.4-fpm.sock` depending on your installation. Check with:
  ```
  ls -l /run/php/
  ```
  and update `fastcgi.server` accordingly.

Restart services after changes:
```
sudo systemctl restart php8.4-fpm
sudo systemctl restart lighttpd
```

## Usage

- Open `index.php` via your configured host/port.
- Browse directories and files.
- Upload files via the upload UI.
- Create folders as needed.
- Download files using the provided links.
- Delete files/folders when cleanup is needed.

By design, there is no authentication or authorization. Use NanoCloud only on trusted private networks.

## Security Model

- Intended for LAN/home environments with trusted users.
- No authentication/authorization. Anyone with access to the site can perform allowed operations.
- If you require auth, consider placing NanoCloud behind a reverse proxy providing Basic Auth.

## API Endpoints

All endpoints are routed through `nanocloud_api.php`:

- `GET nanocloud_api.php?action=info`
  - Returns `{ success, maxFileBytes, maxSessionBytes }`
- `GET nanocloud_api.php?action=list[&path=relative]`
  - Returns `{ success, items, path, breadcrumbs, storage }`
- `POST nanocloud_api.php` with `action=upload`, `path`, `files[]`
  - Returns `{ success, results:[{success, filename, message}], storage }`
- `POST nanocloud_api.php` with `action=delete`, `path`, `filename`
- `POST nanocloud_api.php` with `action=create_dir`, `path`, `name`
- `POST nanocloud_api.php` with `action=delete_dir`, `path`, `name`

File download:
- `GET nanocloud_download.php?path=<relative>&file=<name>`

## Roadmap

- Optional authentication layer for non-trusted environments.
- Role-based restrictions (e.g., disable delete).
- Mobile-first UI improvements.
- Configurable per-directory quotas and limits.
- Basic file previews for common types.

## Contributing

Contributions are welcome. Please:
- Open an issue describing the problem or feature.
- Fork the repo and create a feature branch.
- Submit a pull request with a clear description and any relevant screenshots/tests.

## License

MIT License. See `LICENSE` for details.
