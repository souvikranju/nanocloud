# NanoCloud - Web Root Compatibility

## Overview

NanoCloud uses a `public/` subdirectory structure for enhanced security, but maintains **full backward compatibility** with v1.0's web root configuration through a simple single-file redirector.

## The Solution

### Single Root-Level Redirector

One simple PHP file at the root redirects all traffic to the `public/` directory:

```
/nanocloud/
├── index.php          ← Single redirector to public/
└── public/            ← Actual application
    ├── index.php
    ├── api.php
    ├── download.php
    ├── update_api.php
    └── assets/
```

## How It Works

### The Redirector (index.php)
```php
<?php
header('Location: public/index.php');
exit;
```

**What happens:**
1. User accesses `http://server/`
2. Root `index.php` redirects to `public/index.php`
3. Browser URL changes to `http://server/public/`
4. All subsequent requests are relative to `/public/`
5. JavaScript calls `api.php` → resolves to `/public/api.php` ✅
6. Assets load from `assets/` → resolves to `/public/assets/` ✅
7. Everything works naturally!

## Why This Simple Approach Works

Once the browser is redirected to `/public/`, the base URL becomes `/public/` and:

- **API calls**: `fetch('api.php')` → `/public/api.php`
- **Downloads**: `window.open('download.php?...')` → `/public/download.php`
- **Updates**: `fetch('update_api.php?...')` → `/public/update_api.php`
- **Assets**: `<link href="assets/css/style.css">` → `/public/assets/css/style.css`
- **Images**: `<img src="assets/images/logo.png">` → `/public/assets/images/logo.png`

All paths are relative to the current location (`/public/`), so everything resolves correctly without needing additional redirectors or symlinks!

## Benefits

### ✅ Minimal Complexity
- Only ONE file at root level
- No symlinks needed
- No multiple redirectors
- Clean and simple

### ✅ Zero Configuration Required
- Existing web server configs work unchanged
- No need to reconfigure DocumentRoot
- No need to update virtual hosts
- Works with Apache, Nginx, Lighttpd

### ✅ Seamless Updates
- v1.0 → current version update "just works"
- No manual intervention needed
- No downtime for reconfiguration
- Automatic during GitHub update

### ✅ Security Maintained
- `src/`, `config/`, `storage/` still protected
- `.htaccess` rules still apply
- Backend code not in web root

### ✅ Performance
- Single redirect on initial page load
- All subsequent requests are direct
- No overhead for API calls or assets

## Web Server Compatibility

### Apache
```apache
# Existing config - NO CHANGES NEEDED
<VirtualHost *:80>
    DocumentRoot /path/to/nanocloud
    # ... rest of config
</VirtualHost>
```

### Nginx
```nginx
# Existing config - NO CHANGES NEEDED
server {
    root /path/to/nanocloud;
    # ... rest of config
}
```

### Lighttpd
```lighttpd
# Existing config - NO CHANGES NEEDED
server.document-root = "/path/to/nanocloud"
# ... rest of config
```

## Optional: Direct public/ Access

For optimal performance (eliminates the initial redirect), you can optionally point directly to `public/`:

### Apache
```apache
<VirtualHost *:80>
    DocumentRoot /path/to/nanocloud/public
    <Directory /path/to/nanocloud/public>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

### Nginx
```nginx
server {
    root /path/to/nanocloud/public;
    
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }
    
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.0-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
    }
}
```

### Lighttpd
```lighttpd
server.document-root = "/path/to/nanocloud/public"

url.rewrite-if-not-file = (
    "^/(.*)$" => "/index.php/$1"
)
```

**But remember**: This is **optional**! The single redirector works perfectly fine.

## Technical Details

### Why public/ Subdirectory?

The `public/` subdirectory provides:

1. **Clear Separation**: Public vs. private files
2. **Security by Default**: Backend code not in web root
3. **Industry Standard**: Follows modern PHP framework patterns (Laravel, Symfony, etc.)
4. **Future-Proof**: Easier to add more backend components

### Why Single Redirector?

**Simplicity**: One file is easier to understand and maintain than multiple redirectors or symlinks.

**Natural Resolution**: Once in `/public/`, all relative paths resolve correctly without additional help.

**Performance**: Only one redirect on initial page load. All subsequent requests (API, assets, etc.) are direct.

## Update Process

When updating from v1.0 to current version:

1. **GitHub update downloads current version**
2. **Extracts to staging directory**
3. **Deploys to application directory**
   - Includes single `index.php` redirector
   - Includes complete `public/` directory
4. **Preserves config and storage**
5. **Done!**

No manual steps required. The redirector is part of the current version package.

## Verification

After update, verify the redirector works:

```bash
# Check redirector exists
ls -la /path/to/nanocloud/index.php

# Check public directory exists
ls -la /path/to/nanocloud/public/

# Test redirect
curl -I http://your-server/
# Should show: Location: public/index.php

# Test application
curl http://your-server/public/api.php?action=info
# Should return JSON with storage info
```

## Troubleshooting

### Issue: "Too many redirects"

**Cause**: Web server already configured to point to `public/`  
**Solution**: Remove root-level `index.php` or update web server config to point to root

### Issue: 404 on API calls

**Cause**: Browser not in `/public/` context  
**Solution**: Ensure initial redirect to `public/index.php` is working

### Issue: Assets not loading

**Cause**: Incorrect relative paths in HTML  
**Solution**: Verify all asset paths are relative (e.g., `assets/css/style.css` not `/assets/css/style.css`)

## Summary

The single-file redirector provides:

✅ **Minimal Complexity**: Just one file at root  
✅ **Backward Compatibility**: v1.0 configs work unchanged  
✅ **Zero Configuration**: No manual setup required  
✅ **Seamless Updates**: Automatic during older version→current migration  
✅ **Security**: Backend code protected  
✅ **Performance**: Single redirect, then direct access  
✅ **Simplicity**: Easy to understand and maintain  

**Result**: Clean, simple solution that "just works"!

---

**Last Updated**: January 21, 2026  
**Version**: X.X.X
