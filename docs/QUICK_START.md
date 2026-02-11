# Quick Start Guide

Get NanoCloud up and running quickly.

## Prerequisites

- PHP 8.0 or higher
- Web server (Apache, Nginx, or Lighttpd)
- Write permissions for storage directory

## Installation Steps

### 1. Download NanoCloud

```bash
# Clone from GitHub
git clone https://github.com/souvikranju/nanocloud.git
cd nanocloud

# Or download and extract ZIP
wget https://github.com/souvikranju/nanocloud/archive/main.zip
unzip main.zip
cd nanocloud-main
```

### 2. Configure Web Server

Configure your web server to point to the installation directory:

#### Apache

Edit your virtual host configuration:

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

**Enable required modules:**
```bash
sudo a2enmod rewrite
sudo systemctl restart apache2
```

**Note**: The `.htaccess` file in the public directory provides security rules for Apache.

#### Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/nanocloud;
    index index.php;
    
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }
    
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.0-fpm.sock;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }
    
    # Deny access to sensitive directories
    location ~ ^/(src|config|storage) {
        deny all;
        return 404;
    }
    
    # Deny access to hidden files
    location ~ /\. {
        deny all;
        return 404;
    }
}
```

**Restart Nginx:**
```bash
sudo systemctl restart nginx
```

#### Lighttpd

**Important**: `.htaccess` does NOT work with Lighttpd. Use the provided `lighttpd.conf` instead.

```bash
# 1. Copy the configuration file
sudo cp /var/www/nanocloud/lighttpd.conf /etc/lighttpd/conf-available/nanocloud.conf

# 2. Edit the document root path if needed
sudo nano /etc/lighttpd/conf-available/nanocloud.conf

# 3. Enable the configuration
sudo ln -s /etc/lighttpd/conf-available/nanocloud.conf /etc/lighttpd/conf-enabled/

# 4. Enable required modules
sudo lighttpd-enable-mod fastcgi
sudo lighttpd-enable-mod compress
sudo lighttpd-enable-mod expire

# 5. Test configuration
sudo lighttpd -t -f /etc/lighttpd/lighttpd.conf

# 6. Restart Lighttpd
sudo systemctl restart lighttpd
```

**Note**: The `lighttpd.conf` file includes all security rules equivalent to `.htaccess`.

### 3. Configure NanoCloud

```bash
# Copy example configuration
cp config/local.php.example config/local.php

# Edit configuration
nano config/local.php
```

**Minimum required settings:**
```php
<?php
// Storage location (absolute path)
$STORAGE_ROOT = '/var/www/nanocloud/storage';
```

### 4. Set Permissions

```bash
# Set ownership (replace www-data with your web server user)
sudo chown -R www-data:www-data /var/www/nanocloud

# Set directory permissions
sudo chmod 755 /var/www/nanocloud
sudo chmod 755 /var/www/nanocloud/storage

# Verify permissions
ls -la /var/www/nanocloud
```

### 5. Configure PHP (Optional)

Edit `php.ini` to allow large uploads:

```ini
file_uploads = On
upload_max_filesize = 5G
post_max_size = 6G
max_file_uploads = 50
max_execution_time = 300
max_input_time = 300
memory_limit = 256M
```

**Find php.ini location:**
```bash
php --ini
```

**Restart PHP after changes:**
```bash
# PHP-FPM
sudo systemctl restart php8.0-fpm  # service name varies by distro/version (e.g. php8.2-fpm)

# Apache with mod_php
sudo systemctl restart apache2
```

### 6. Access NanoCloud

Open your browser and navigate to:
```
http://your-domain.com
```

Or if using IP address:
```
http://your-server-ip
```

## Verification

Once accessed, you should see:
- ✅ NanoCloud header with logo
- ✅ Storage meter
- ✅ File list (empty initially)
- ✅ Upload button (FAB in bottom right)
- ✅ No PHP errors

## Quick Test

1. **Upload a file**: Click the `+` button or drag & drop
2. **Create a folder**: Click "New Folder"
3. **Navigate**: Click into the folder
4. **Delete**: Select item and click delete
5. **Search**: Try the search box

## Development Server (Testing Only)

For quick testing without configuring a web server:

```bash
cd /var/www/nanocloud
php -S 0.0.0.0:8080 -t .
```

Then access via: `http://your-server-ip:8080`

**Warning**: Only use for testing. Not suitable for production.

## Troubleshooting

### Blank Page

```bash
# Check PHP error log
sudo tail -f /var/log/php-fpm/error.log

# Enable error display temporarily (in public/index.php)
ini_set('display_errors', '1');
error_reporting(E_ALL);
```

### Permission Errors

```bash
# Fix ownership
sudo chown -R www-data:www-data /var/www/nanocloud

# Fix permissions
sudo chmod -R 755 /var/www/nanocloud
sudo chmod 755 /var/www/nanocloud/storage
```

### Upload Fails

```bash
# Check PHP limits
php -i | grep upload_max_filesize
php -i | grep post_max_size

# Increase limits in php.ini
upload_max_filesize = 5G
post_max_size = 6G

# Restart PHP (service name varies by distro/version, e.g. php8.2-fpm)
sudo systemctl restart php8.0-fpm
```

### 404 Errors

**Apache:**
```bash
# Enable mod_rewrite
sudo a2enmod rewrite
sudo systemctl restart apache2

# Check .htaccess exists
ls -la /var/www/nanocloud/.htaccess
```

**Nginx:**
- Verify location blocks in config
- Check error log: `sudo tail -f /var/log/nginx/error.log`

**Lighttpd:**
- Ensure lighttpd.conf is enabled
- Check error log: `sudo tail -f /var/log/lighttpd/error.log`

## Security Considerations

### For Private Networks

- Default configuration is suitable for trusted private networks
- No authentication required
- All users have at least read access

### For Public Access

**DO NOT expose to public internet without authentication!**

If you must make it publicly accessible, add authentication:

**Apache (Basic Auth):**
```apache
<Directory /var/www/nanocloud>
    AuthType Basic
    AuthName "NanoCloud"
    AuthUserFile /etc/apache2/.htpasswd
    Require valid-user
</Directory>
```

**Nginx (Basic Auth):**
```nginx
location / {
    auth_basic "NanoCloud";
    auth_basic_user_file /etc/nginx/.htpasswd;
}
```

**Create password file:**
```bash
sudo htpasswd -c /etc/apache2/.htpasswd username
```

## Next Steps

- **[Configuration Guide](CONFIGURATION.md)** - Customize settings
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues

---

**Last Updated:** January 21, 2026
