# NanoCloud - Deployment Guide

## Overview

This guide covers deploying NanoCloud on various web servers with different access methods.

## Prerequisites

- PHP 8.0 or higher
- Web server (Apache, Nginx, or Lighttpd)
- Write permissions for storage directory
- Basic command-line knowledge

## Deployment Methods

### Method 1: Root Access (Recommended - Most Secure)

This method makes the `public/` directory your web root, exposing only necessary files.

#### For Apache

1. **Configure Virtual Host:**
```bash
sudo nano /etc/apache2/sites-available/nanocloud.conf
```

Add:
```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /var/www/nanocloud
    
    <Directory /var/www/nanocloud>
        AllowOverride All
        Require all granted
    </Directory>
    
    ErrorLog ${APACHE_LOG_DIR}/nanocloud-error.log
    CustomLog ${APACHE_LOG_DIR}/nanocloud-access.log combined
</VirtualHost>
```

2. **Enable site and restart:**
```bash
sudo a2ensite nanocloud
sudo systemctl restart apache2
```

3. **Access:** `http://your-domain.com/`

#### For Nginx

1. **Configure Server Block:**
```bash
sudo nano /etc/nginx/sites-available/nanocloud
```

Add:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/nanocloud;
    index index.php index.html;
    
    # Logging
    access_log /var/log/nginx/nanocloud-access.log;
    error_log /var/log/nginx/nanocloud-error.log;
    
    # Main location
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }
    
    # PHP processing
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.0-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
    
    # Deny access to sensitive directories
    location ~ ^/(src|config|storage|docs) {
        deny all;
        return 404;
    }
    
    # Deny access to sensitive files
    location ~ \.(md|json|example|gitignore|htaccess)$ {
        deny all;
        return 404;
    }
    
    # Static file caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

2. **Enable site and restart:**
```bash
sudo ln -s /etc/nginx/sites-available/nanocloud /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

3. **Access:** `http://your-domain.com/`

#### For Lighttpd

1. **Copy configuration:**
```bash
sudo cp /var/www/nanocloud/lighttpd.conf /etc/lighttpd/conf-available/nanocloud.conf
```

2. **Edit document root if needed:**
```bash
sudo nano /etc/lighttpd/conf-available/nanocloud.conf
```

Ensure this line points to your installation:
```
server.document-root = "/var/www/nanocloud"
```

3. **Enable configuration:**
```bash
sudo ln -s /etc/lighttpd/conf-available/nanocloud.conf /etc/lighttpd/conf-enabled/
sudo lighttpd-enable-mod fastcgi
sudo lighttpd-enable-mod compress
sudo lighttpd-enable-mod expire
```

4. **Test and restart:**
```bash
sudo lighttpd -t -f /etc/lighttpd/lighttpd.conf
sudo systemctl restart lighttpd
```

5. **Access:** `http://your-domain.com/`

### Method 2: Symlink to Root

Replace your web root with a symlink to the public directory.

```bash
# Backup existing web root
sudo mv /var/www/html /var/www/html.backup

# Create symlink
sudo ln -s /var/www/nanocloud /var/www/html

# Set ownership
sudo chown -h www-data:www-data /var/www/html
```

**Access:** `http://<server_ip>/`

### Method 3: Subdirectory Access

Create a symlink in your existing web root.

```bash
cd /var/www/html
sudo ln -s /var/www/nanocloud nanocloud
```

**Access:** `http://<server_ip>/nanocloud/`

### Method 4: Direct Path Access

If you can't modify server configuration, access directly via path.

**Access:** `http://<server_ip>/nanocloud/`

**Note:** This assumes `/var/www` is your web root.

## Configuration

### 1. Create Local Configuration

```bash
cd /var/www/nanocloud
cp config/local.php.example config/local.php
nano config/local.php
```

### 2. Essential Settings

Edit `config/local.php`:

```php
<?php
// Storage location (must be writable)
$STORAGE_ROOT = '/var/www/nanocloud/storage';

// Upload limits
$USER_DEFINED_MAX_FILE_SIZE = 5368709120; // 5GB
$MAX_SESSION_BYTES = 5368709120; // 5GB per session

// File permissions
$DIR_PERMISSIONS = 0755;
$FILE_PERMISSIONS = 0644;

// Optional: Set file ownership
// $FILE_OWNER = 'www-data';
// $FILE_GROUP = 'www-data';

// Operation controls
$READ_ONLY = false;
$UPLOAD_ENABLED = true;
$DELETE_ENABLED = true;
$RENAME_ENABLED = true;
$MOVE_ENABLED = true;

// Optional: Download rate limiting (MB/s, 0 = unlimited)
$DOWNLOAD_RATE_LIMIT_MB = 0;
```

### 3. Set Permissions

```bash
# Storage directory
chmod 755 storage
chown www-data:www-data storage

# Configuration (should not be web-accessible)
chmod 640 config/local.php
chown www-data:www-data config/local.php
```

## Security Hardening

### 1. File Permissions

```bash
# Set proper ownership
sudo chown -R www-data:www-data /var/www/nanocloud

# Restrict permissions
sudo chmod -R 755 /var/www/nanocloud
sudo chmod -R 750 /var/www/nanocloud/src
sudo chmod -R 750 /var/www/nanocloud/config
sudo chmod 640 /var/www/nanocloud/config/local.php
```

### 2. Disable PHP Functions (Optional)

Add to `php.ini` or `.user.ini`:
```ini
disable_functions = exec,passthru,shell_exec,system,proc_open,popen
```

### 3. Enable HTTPS (Recommended)

#### Using Let's Encrypt (Certbot)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-apache  # For Apache
# OR
sudo apt install certbot python3-certbot-nginx   # For Nginx

# Obtain certificate
sudo certbot --apache -d your-domain.com  # For Apache
# OR
sudo certbot --nginx -d your-domain.com   # For Nginx

# Auto-renewal is configured automatically
```

### 4. Firewall Configuration

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## PHP Configuration

### Recommended php.ini Settings

```ini
# Upload limits (adjust as needed)
upload_max_filesize = 5G
post_max_size = 5G
max_execution_time = 300
max_input_time = 300
memory_limit = 512M

# Security
expose_php = Off
display_errors = Off
log_errors = On
error_log = /var/log/php-errors.log

# Session
session.cookie_httponly = 1
session.cookie_secure = 1  # If using HTTPS
session.use_strict_mode = 1
```

## Verification

### 1. Check PHP Version
```bash
php -v
# Should show PHP 8.0 or higher
```

### 2. Test Web Access
Visit your URL and verify:
- ✅ Page loads without errors
- ✅ Storage meter displays
- ✅ File list shows (empty initially)
- ✅ Upload button visible

### 3. Test Upload
- Click upload button
- Select a small file
- Verify it uploads successfully

### 4. Check Logs
```bash
# Apache
tail -f /var/log/apache2/nanocloud-error.log

# Nginx
tail -f /var/log/nginx/nanocloud-error.log

# Lighttpd
tail -f /var/log/lighttpd/error.log

# PHP
tail -f /var/log/php-fpm/error.log
```

## Troubleshooting

### Issue: "Class not found" errors

**Solution:**
```bash
# Verify PHP version
php -v

# Check autoloader
ls -la /var/www/nanocloud/src/autoload.php

# Check file permissions
ls -la /var/www/nanocloud/src/
```

### Issue: Permission denied on storage

**Solution:**
```bash
sudo chown -R www-data:www-data storage
sudo chmod -R 755 storage
```

### Issue: 404 errors

**Solution:**
- Verify DocumentRoot points to `public/` directory
- Check that index.php exists in public/
- Verify web server configuration is active

### Issue: Upload fails

**Solution:**
1. Check PHP upload limits in `php.ini`
2. Verify storage directory is writable
3. Check disk space: `df -h`
4. Review PHP error logs

### Issue: Blank page

**Solution:**
1. Enable error display temporarily:
   ```php
   // Add to public/index.php (top)
   ini_set('display_errors', 1);
   error_reporting(E_ALL);
   ```
2. Check PHP error logs
3. Verify all required files exist

## Performance Optimization

### 1. Enable OPcache

Add to `php.ini`:
```ini
opcache.enable=1
opcache.memory_consumption=128
opcache.interned_strings_buffer=8
opcache.max_accelerated_files=10000
opcache.revalidate_freq=2
```

### 2. Enable Compression

Already configured in:
- Apache: `.htaccess`
- Nginx: Server block
- Lighttpd: `lighttpd.conf`

### 3. Browser Caching

Already configured for static assets (CSS, JS, images).

## Backup Strategy

### 1. Configuration Backup
```bash
cp config/local.php config/local.php.backup
```

### 2. Storage Backup
```bash
tar -czf storage-backup-$(date +%Y%m%d).tar.gz storage/
```

### 3. Automated Backup Script
```bash
#!/bin/bash
BACKUP_DIR="/backups/nanocloud"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/nanocloud-$DATE.tar.gz \
    /var/www/nanocloud/storage \
    /var/www/nanocloud/config/local.php

# Keep only last 7 days
find $BACKUP_DIR -name "nanocloud-*.tar.gz" -mtime +7 -delete
```

## Monitoring

### 1. Disk Space
```bash
df -h /var/www/nanocloud/storage
```

### 2. Error Logs
```bash
# Set up log rotation
sudo nano /etc/logrotate.d/nanocloud
```

Add:
```
/var/log/apache2/nanocloud-*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        systemctl reload apache2 > /dev/null
    endscript
}
```

## Maintenance

### Regular Tasks

1. **Check disk space** (weekly)
2. **Review error logs** (weekly)
3. **Update PHP** (as needed)
4. **Backup storage** (daily/weekly)
5. **Test uploads** (monthly)

### Updates

When updating NanoCloud:
1. Backup current installation
2. Replace files (except `config/local.php` and `storage/`)
3. Test functionality
4. Monitor logs

## Support

For issues or questions:
- Check documentation: `README.md`, `ARCHITECTURE.md`
- Review logs for errors
- Verify configuration settings
- Check file permissions

---

**NanoCloud** - Production-Ready Deployment
