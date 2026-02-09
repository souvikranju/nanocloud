# Troubleshooting Guide

Common issues and solutions for NanoCloud.

## Upload Issues

### Upload Fails Immediately

**Symptoms:**
- Upload button doesn't work
- Files don't appear in upload queue
- No error message

**Causes & Solutions:**

1. **Uploads Disabled**
   ```php
   // Check config/local.php
   $UPLOAD_ENABLED = true;  // Must be true
   $READ_ONLY = false;      // Must be false
   ```

2. **Browser Console Errors**
   - Open browser console (F12)
   - Look for JavaScript errors
   - Check network tab for failed requests

3. **File Input Not Working**
   - Try drag & drop instead
   - Try different browser
   - Clear browser cache

### Upload Fails During Transfer

**Symptoms:**
- Upload starts but fails partway through
- "Upload failed" error message
- Network error in console

**Causes & Solutions:**

1. **File Too Large**
   ```bash
   # Check PHP limits
   php -i | grep upload_max_filesize
   php -i | grep post_max_size
   
   # Increase in php.ini
   upload_max_filesize = 5G
   post_max_size = 5G
   
   # Restart PHP
   sudo systemctl restart php8.0-fpm
   ```

2. **Session Limit Exceeded**
   ```php
   // Increase in config/local.php
   $MAX_SESSION_BYTES = 10737418240; // 10GB
   ```

3. **Network Timeout**
   ```ini
   # In php.ini
   max_execution_time = 600
   max_input_time = 600
   ```

4. **Web Server Limits**
   ```nginx
   # Nginx: /etc/nginx/nginx.conf
   client_max_body_size 5G;
   client_body_timeout 600s;
   ```

### Upload Succeeds But File Not Visible

**Symptoms:**
- Upload completes successfully
- File doesn't appear in list
- No error message

**Causes & Solutions:**

1. **Permission Issues**
   ```bash
   # Check storage permissions
   ls -la storage/
   
   # Fix permissions
   sudo chown -R www-data:www-data storage
   sudo chmod -R 755 storage
   ```

2. **Hidden Files**
   - Files starting with `.` are hidden
   - Rename file without leading dot

3. **Wrong Directory**
   - Check you're in correct folder
   - Use breadcrumbs to navigate
   - Refresh page (F5)

## Permission Errors

### "Permission denied" Errors

**Symptoms:**
- Cannot create folders
- Cannot upload files
- Cannot delete items

**Solution:**
```bash
# Check current permissions
ls -la /path/to/nanocloud

# Fix ownership
sudo chown -R www-data:www-data /path/to/nanocloud

# Fix permissions
sudo chmod -R 755 /path/to/nanocloud
sudo chmod -R 755 /path/to/nanocloud/storage

# Verify web server user
ps aux | grep -E 'apache|nginx|php-fpm' | head -1
```

### "Failed to set permissions" Warning

**Symptoms:**
- Files upload but warning appears
- Operations work but show warnings

**Cause:** Configured permissions can't be applied

**Solution:**
```php
// In config/local.php, use more permissive settings
$DIR_PERMISSIONS = 0755;  // Instead of 0700
$FILE_PERMISSIONS = 0644; // Instead of 0600

// Or remove ownership settings
$FILE_OWNER = null;
$FILE_GROUP = null;
```

## Page Loading Issues

### Blank White Page

**Symptoms:**
- Page loads but shows nothing
- No errors visible

**Causes & Solutions:**

1. **PHP Errors**
   ```bash
   # Check PHP error log
   tail -f /var/log/php-fpm/error.log
   
   # Or enable display temporarily
   # In public/index.php (top of file):
   ini_set('display_errors', '1');
   error_reporting(E_ALL);
   ```

2. **Missing PHP Extensions**
   ```bash
   # Check required extensions
   php -m | grep -E 'fileinfo|json'
   
   # Install if missing
   sudo apt-get install php-fileinfo php-json
   sudo systemctl restart php8.0-fpm
   ```

3. **Autoloader Issues**
   ```bash
   # Test autoloader
   php -r "require 'src/autoload.php'; echo 'OK';"
   ```

### 404 Not Found

**Symptoms:**
- Page shows "404 Not Found"
- Assets not loading

**Causes & Solutions:**

1. **Wrong Document Root**
   ```apache
   # Apache: Should point to public/
   DocumentRoot /path/to/nanocloud/public
   ```

2. **Missing .htaccess**
   ```bash
   # Check if .htaccess exists
   ls -la public/.htaccess
   ```

3. **Rewrite Module Disabled**
   ```bash
   # Apache: Enable mod_rewrite
   sudo a2enmod rewrite
   sudo systemctl restart apache2
   ```

### 500 Internal Server Error

**Symptoms:**
- Page shows "500 Internal Server Error"

**Solution:**
```bash
# Check web server error log
sudo tail -f /var/log/apache2/error.log  # Apache
sudo tail -f /var/log/nginx/error.log    # Nginx

# Check PHP error log
sudo tail -f /var/log/php-fpm/error.log

# Common causes:
# - PHP syntax errors
# - Missing files
# - Permission issues
# - .htaccess errors (Apache)
```

## API Errors

### "Unknown action" Error

**Symptoms:**
- Operations fail with "Unknown action"
- API calls return errors

**Causes & Solutions:**

1. **Old JavaScript Cache**
   ```javascript
   // Hard refresh browser
   // Ctrl+Shift+R (Windows/Linux)
   // Cmd+Shift+R (Mac)
   ```

2. **API Endpoint Wrong**
   ```javascript
   // Check public/assets/js/constants.js
   export const API_URL = 'api.php';  // Should be 'api.php'
   ```

3. **Web Server Routing**
   - Ensure requests to `api.php` reach the file
   - Check web server configuration

### API Returns HTML Instead of JSON

**Symptoms:**
- Console shows "Unexpected token <"
- API responses are HTML pages

**Causes:**
- PHP errors being displayed as HTML
- Wrong file being served
- Redirect to error page

**Solution:**
```bash
# Check what's being returned
curl http://your-server/api.php?action=info

# Should return JSON, not HTML
# If HTML, check PHP error logs
```

## Search & Sort Issues

### Search Not Working

**Symptoms:**
- Search box doesn't filter results
- No results shown

**Solutions:**

1. **Clear Search**
   - Click X button in search box
   - Refresh page

2. **JavaScript Errors**
   - Check browser console
   - Hard refresh (Ctrl+Shift+R)

3. **Case Sensitivity**
   - Search is case-insensitive
   - Try different terms

### Sort Not Working

**Symptoms:**
- Sort dropdown doesn't change order
- Items remain in same order

**Solutions:**

1. **Clear Browser Cache**
   ```javascript
   // Clear localStorage
   localStorage.clear();
   // Refresh page
   ```

2. **Check Console**
   - Look for JavaScript errors
   - Verify state.js is loaded

## Mobile Issues

### Touch Not Working

**Symptoms:**
- Can't select items on mobile
- Buttons don't respond

**Solutions:**

1. **Enable Touch Events**
   - Ensure JavaScript is enabled
   - Try different mobile browser

2. **Viewport Issues**
   ```html
   <!-- Check meta viewport tag in index.php -->
   <meta name="viewport" content="width=device-width, initial-scale=1.0">
   ```

3. **Clear Mobile Cache**
   - Clear browser cache
   - Close and reopen browser

### Long Press Not Selecting

**Symptoms:**
- Press and hold doesn't select items
- No haptic feedback

**Solution:**
- Hold for full 500ms
- Don't move finger while holding
- Try on different items

## Configuration Issues

### Changes Not Taking Effect

**Symptoms:**
- Modified config/local.php
- Changes don't apply

**Solutions:**

1. **Restart PHP**
   ```bash
   sudo systemctl restart php8.0-fpm
   sudo systemctl restart apache2  # If using mod_php
   ```

2. **Check Syntax**
   ```bash
   php -l config/local.php
   ```

3. **Verify File Location**
   ```bash
   ls -la config/local.php
   # Should exist and be readable
   ```

4. **Check Opcode Cache**
   ```bash
   # Clear OPcache
   sudo systemctl restart php8.0-fpm
   ```

### Config File Not Found

**Symptoms:**
- "Config file not found" error
- Using default settings

**Solution:**
```bash
# Create config file
cp config/local.php.example config/local.php

# Edit settings
nano config/local.php

# Set permissions
chmod 644 config/local.php
```

## Performance Issues

### Slow Page Load

**Causes & Solutions:**

1. **Large Directory**
   - Many files in one folder
   - Use subdirectories to organize

2. **Slow Storage**
   - Network storage latency
   - Use local storage if possible

3. **PHP Performance**
   ```ini
   # In php.ini
   opcache.enable=1
   opcache.memory_consumption=128
   ```

### Slow Uploads

**Causes:**
- Network bandwidth
- Server CPU/disk
- Concurrent uploads

**Solutions:**
```javascript
// Reduce concurrent uploads
// In public/assets/js/constants.js
export const MAX_CONCURRENT_UPLOADS = 2;  // Reduce from 3
```

## Browser-Specific Issues

### Works in Chrome, Not in Firefox

**Solution:**
- Clear Firefox cache
- Check Firefox console for errors
- Ensure ES6 modules supported (Firefox 60+)

### Works in Desktop, Not in Safari Mobile

**Solution:**
- Clear Safari cache
- Check iOS version (iOS 14+)
- Test in different iOS browser

## Getting More Help

### Collect Debug Information

```bash
# System info
uname -a
php -v
df -h

# PHP configuration
php -i > phpinfo.txt

# Permissions
ls -laR /path/to/nanocloud > permissions.txt

# Error logs
sudo tail -100 /var/log/php-fpm/error.log > php-errors.txt
sudo tail -100 /var/log/apache2/error.log > apache-errors.txt
```

### Enable Debug Mode

```javascript
// In browser console
localStorage.setItem('debug', 'true');
// Reload page
// Check console for detailed logs
```

### Report Issues

When reporting issues, include:
- NanoCloud version
- PHP version
- Web server (Apache/Nginx/Lighttpd)
- Operating system
- Browser and version
- Error messages (exact text)
- Steps to reproduce
- Screenshots if applicable

**GitHub Issues:** https://github.com/souvikranju/nanocloud/issues

## See Also

- [Configuration Guide](CONFIGURATION.md) - Configuration options
- [Updates Guide](UPDATES.md) - Update system

---

**Last Updated:** January 21, 2026
