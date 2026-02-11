# Self-Update System

NanoCloud includes a built-in self-update mechanism that allows you to update to the latest version directly from the web interface.

## Overview

The update system:
- Checks for updates from GitHub releases
- Downloads and extracts updates automatically (from the GitHub Releases “latest” endpoint)
- Creates backups before updating
- Supports rollback if update fails
- Preserves your configuration and files

## Requirements

### System Requirements

- **PHP Extensions**: `PharData` for archive handling (used for both download validation and extraction)
- **Write Permissions**: Web server must have write access to installation directory
- **rsync**: Required for atomic deployment (usually pre-installed on Linux)
- **Internet Access**: To fetch updates from GitHub

### Checking Requirements

```bash
# Check if PharData is available
php -r "if (class_exists('PharData')) echo 'OK'; else echo 'Missing';"

# Check if rsync is installed
which rsync

# Check write permissions
ls -la /path/to/nanocloud
# Web server user (e.g., www-data) should have write access
```

## Using the Update System

### From Web Interface

1. **Open NanoCloud** in your browser
2. **Click the Info button** (ℹ) in the header
3. **Check for Updates**:
   - Current version is displayed
   - Click "Check for Updates" button
   - System queries GitHub for latest release
4. **Review Update**:
   - If update available, version and release notes are shown
   - Review changes before proceeding
5. **Start Update**:
   - Click "Update to [version]" button
   - Confirm the update
   - System will:
     - Create automatic backup
     - Download update from GitHub
     - Extract and stage files
     - Deploy atomically
     - Update version.json
6. **Verify**:
   - Page reloads automatically
   - Check that everything works
   - Your files and settings are preserved

### Update Process Flow

```
1. User clicks "Check for Updates"
   ↓
2. System queries GitHub API
   ↓
3. Compare versions
   ↓
4. If update available, show details
   ↓
5. User clicks "Update"
   ↓
6. Create backup (in .temp/backup/)
   ↓
7. Download update (to .temp/update_download/)
   ↓
8. Extract to staging (in .temp/update_staging/)
   ↓
9. Verify required files exist
   ↓
10. Deploy with rsync (atomic operation)
    ↓
11. Update version.json
    ↓
12. Cleanup temporary files
    ↓
13. Success! Page reloads
```

## What Gets Preserved

During updates, these are automatically preserved:

✅ **Configuration**: `config/local.php`  
✅ **User Files**: Everything in `storage/`  
✅ **Temporary Files**: `.temp/` directory  
✅ **Git Files**: `.git/`, `.gitignore` (if present)  

## What Gets Replaced

These are completely replaced with new versions:

🔄 **All PHP files**: Backend code  
🔄 **All JavaScript files**: Frontend code  
🔄 **All CSS files**: Styling  
🔄 **Documentation**: README, guides  
🔄 **Configuration defaults**: `config/defaults.php`  

## Rollback

If an update fails or causes issues, you can rollback to the previous version.

### Automatic Rollback

The update system automatically rolls back if:
- Download fails
- Extraction fails
- Required files are missing
- Deployment fails

### Manual Rollback

#### From Web Interface

1. Open browser console (F12)
2. Run:
   ```javascript
   fetch('update_api.php?action=rollback', {method: 'POST'})
     .then(r => r.json())
     .then(console.log);
   ```
3. Refresh page

#### From Command Line

```bash
# Navigate to installation directory
cd /path/to/nanocloud

# Check if backup exists
ls -la .temp/backup/nanocloud_backup.zip

# Extract backup
cd .temp/backup
unzip -o nanocloud_backup.zip -d /path/to/nanocloud

# Or use the API
curl -X POST http://your-server/update_api.php?action=rollback
```

## Troubleshooting

### Permission Errors

**Problem:** "Failed to create backup directory" or "Deployment failed"

**Solution:**
```bash
# Grant write permissions to web server
sudo chown -R www-data:www-data /path/to/nanocloud
sudo chmod -R 755 /path/to/nanocloud

# Verify permissions
ls -la /path/to/nanocloud
```

### Update Stuck

**Problem:** Update appears to hang or freeze

**Causes:**
- Network timeout
- Large download
- Server resource limits

**Solution:**
```bash
# Check if lock file exists
ls -la /path/to/nanocloud/.temp/update.lock

# If stale (older than 10 minutes), remove it
rm /path/to/nanocloud/.temp/update.lock

# Try update again
```

**Note:** Locks auto-cleanup after 10 minutes.

### Download Fails

**Problem:** "Failed to download update"

**Causes:**
- No internet connection
- GitHub API rate limit
- Firewall blocking

**Solution:**
```bash
# Test GitHub connectivity
curl -I https://api.github.com/repos/souvikranju/nanocloud/releases/latest

# Check PHP can access internet
php -r "echo file_get_contents('https://api.github.com');"

# If behind proxy, configure PHP
# Edit php.ini:
# http.proxy = "proxy.example.com:8080"
```

### Extraction Fails

**Problem:** "Failed to extract update" or "Invalid ZIP archive"

**Causes:**
- Incomplete download
- Corrupted file
- Missing PharData extension

**Solution:**
```bash
# Check PharData extension
php -m | grep Phar

# If missing, install
sudo apt-get install php-phar  # Debian/Ubuntu
sudo yum install php-phar      # CentOS/RHEL

# Restart PHP
sudo systemctl restart php8.0-fpm
```

### Deployment Fails

**Problem:** "Deployment failed" or rsync errors

**Causes:**
- rsync not installed
- Permission issues
- Disk space

**Solution:**
```bash
# Install rsync
sudo apt-get install rsync  # Debian/Ubuntu
sudo yum install rsync      # CentOS/RHEL

# Check disk space
df -h /path/to/nanocloud

# Check rsync works
rsync --version
```

### Rollback Fails

**Problem:** "No backup found" or "Rollback incomplete"

**Causes:**
- Backup was deleted
- Backup corrupted
- Permission issues

**Solution:**
```bash
# Check if backup exists
ls -la .temp/backup/nanocloud_backup.zip

# If backup missing, restore from your own backup
cp -r /path/to/your/backup/* /path/to/nanocloud/

# Or reinstall from GitHub
git clone https://github.com/souvikranju/nanocloud.git
```

## Manual Update

If automatic update fails, you can update manually:

### Method 1: Git Pull

```bash
cd /path/to/nanocloud

# Backup your config
cp config/local.php /tmp/config.local.php.backup

# Pull latest changes
git pull origin main

# Restore your config
cp /tmp/config.local.php.backup config/local.php

# Clear PHP cache
sudo systemctl restart php8.0-fpm
```

### Method 2: Download and Replace

```bash
# Backup current installation
cp -r /path/to/nanocloud /path/to/nanocloud.backup

# Download latest release (example: replace tag with the real release tag)
cd /tmp
wget https://github.com/souvikranju/nanocloud/archive/refs/tags/vX.X.X.zip -O nanocloud-vX.X.X.zip
unzip nanocloud-vX.X.X.zip

# Copy files (preserving config and storage)
rsync -av --exclude='config/local.php' --exclude='storage' \
  nanocloud-X.X.X/ /path/to/nanocloud/

# Set permissions
sudo chown -R www-data:www-data /path/to/nanocloud
sudo chmod -R 755 /path/to/nanocloud
```

## Update API Reference

### Check for Updates

```bash
curl "http://your-server/update_api.php?action=check_version"
```

**Response:**
```json
{
  "success": true,
  "current_version": "X.X.X",
  "latest_version": "2.1.0",
  "update_available": true,
  "download_url": "https://api.github.com/repos/.../zipball/vX.X.X",
  "release_notes": "## What's New\n- Feature 1\n- Feature 2",
  "published_at": "2026-01-20T00:00:00Z"
}
```

### Get Current Version

```bash
curl "http://your-server/update_api.php?action=get_version"
```

**Response:**
```json
{
  "success": true,
  "version": {
    "version": "X.X.X",
    "updated": "2026-01-20T00:00:00+00:00"
  }
}
```

### Start Update

```bash
curl -X POST "http://your-server/update_api.php?action=start_update"
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully updated to vX.X.X",
  "new_version": "vX.X.X"
}
```

### Rollback

```bash
curl -X POST "http://your-server/update_api.php?action=rollback"
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully rolled back to previous version"
}
```

## Security Considerations

### Update Source

- Updates are fetched from official GitHub repository only
- Repository URL is hardcoded in `update_api.php`
- Cannot be changed via configuration (security measure)

### Verification

- Downloaded files are verified as valid ZIP archives
- Required files are checked before deployment
- Atomic deployment ensures no partial updates

### Backup

- Automatic backup created before every update
- Backup stored in `.temp/backup/`
- Can be used for manual rollback if needed

## Best Practices

1. **Backup Before Updating**
   ```bash
   tar -czf nanocloud-backup-$(date +%Y%m%d).tar.gz /path/to/nanocloud
   ```

2. **Test in Development First**
   - Set up test instance
   - Apply update
   - Verify functionality
   - Then update production

3. **Monitor Update Process**
   - Watch browser console for errors
   - Check PHP error logs
   - Verify page reloads successfully

4. **Keep Backups**
   - Don't delete `.temp/backup/` immediately
   - Keep external backups
   - Test restore procedure

5. **Schedule Updates**
   - Update during low-traffic periods
   - Notify users of planned maintenance
   - Have rollback plan ready


## Version File

The `version.json` file tracks the current version:

```json
{
    "version": "X.X.X",
    "updated": "2026-01-20T00:00:00+00:00"
}
```

**Location:** `/path/to/nanocloud/version.json`

**Purpose:**
- Displayed in UI
- Used for update comparison
- Updated automatically during updates

## See Also

- [Configuration Guide](CONFIGURATION.md) - Configuration options
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues

---

**Last Updated:** January 21, 2026
