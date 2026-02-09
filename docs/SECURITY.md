# NanoCloud - Security Guide

**Last Updated**: February 9, 2026  
**Version**: 2.0  
**Audience**: System Administrators, DevOps Engineers

---

## ⚠️ Important Security Notice

> **NanoCloud is designed for trusted private networks only.**
> 
> By default, there is **NO authentication or access control**. Anyone who can reach the application has full access to all files.

---

## Table of Contents

- [Threat Model](#threat-model)
- [Security Checklist](#security-checklist)
- [Deployment Scenarios](#deployment-scenarios)
- [Authentication Options](#authentication-options)
- [Hardening Guide](#hardening-guide)
- [Network Security](#network-security)
- [Monitoring & Auditing](#monitoring--auditing)
- [Incident Response](#incident-response)
- [Compliance Considerations](#compliance-considerations)

---

## Threat Model

### Trusted Network Deployment (Default)

**Assumptions**:
- All users on the network are trusted
- Network is isolated from the internet
- Physical security is in place
- Users understand they have full access

**Threats Mitigated**:
- Path traversal attacks ✅
- File upload exploits ✅
- XSS attacks ✅ (with proper escaping)
- CSRF attacks ⚠️ (partial - session-based)

**Threats NOT Mitigated**:
- Unauthorized access ❌ (no authentication)
- Data exfiltration ❌ (no access control)
- Malicious file uploads ❌ (no scanning)
- Insider threats ❌ (all users trusted)

### Public Internet Deployment (NOT RECOMMENDED)

**⚠️ DO NOT deploy to public internet without additional security layers!**

If you must expose NanoCloud publicly, you MUST implement:
- Authentication (Basic Auth, OAuth, etc.)
- HTTPS/TLS encryption
- Rate limiting
- File scanning
- Access logging
- Intrusion detection

---

## Security Checklist

### Pre-Deployment

- [ ] **Review threat model** - Understand security implications
- [ ] **Choose deployment scenario** - Private network vs public
- [ ] **Plan authentication** - If needed
- [ ] **Configure HTTPS** - For any non-local deployment
- [ ] **Set file permissions** - Restrict access to sensitive files
- [ ] **Review configuration** - Disable unnecessary features
- [ ] **Plan backups** - Regular automated backups
- [ ] **Set up monitoring** - Log aggregation and alerting

### Post-Deployment

- [ ] **Test authentication** - Verify access controls work
- [ ] **Verify HTTPS** - Check certificate validity
- [ ] **Test file operations** - Upload, download, delete
- [ ] **Check logs** - Ensure logging is working
- [ ] **Review permissions** - Verify file system permissions
- [ ] **Test backups** - Verify backup and restore
- [ ] **Monitor resources** - CPU, memory, disk usage
- [ ] **Update documentation** - Document your setup

### Ongoing Maintenance

- [ ] **Review logs weekly** - Check for suspicious activity
- [ ] **Update PHP monthly** - Security patches
- [ ] **Rotate logs** - Prevent disk fill
- [ ] **Test backups monthly** - Verify restore works
- [ ] **Review access quarterly** - Remove unused accounts
- [ ] **Security audit annually** - Comprehensive review

---

## Deployment Scenarios

### Scenario 1: Home Network (Low Risk)

**Use Case**: Personal file sharing at home

**Security Measures**:
```bash
# Minimal - rely on network isolation
# Bind to local network only
# No authentication needed
```

**Recommendations**:
- Keep on private network
- Use strong WiFi password
- Regular backups
- Keep PHP updated

---

### Scenario 2: Office Network (Medium Risk)

**Use Case**: Team file sharing in office

**Security Measures**:
```bash
# Network isolation
# Optional: Basic authentication
# HTTPS recommended
# Access logging
```

**Recommendations**:
- Segment network (VLAN)
- Consider authentication
- Enable HTTPS
- Monitor access logs
- Regular security reviews

---

### Scenario 3: Public Internet (HIGH RISK)

**Use Case**: Remote access from anywhere

**⚠️ REQUIRES ADDITIONAL SECURITY LAYERS**

**Mandatory Security Measures**:
```bash
# HTTPS (required)
# Authentication (required)
# Rate limiting (required)
# Firewall rules (required)
# Access logging (required)
# Intrusion detection (recommended)
# File scanning (recommended)
```

**Implementation**: See [Authentication Options](#authentication-options)

---

## Authentication Options

### Option 1: Basic Authentication (Simple)

#### Apache

**1. Create password file:**
```bash
sudo htpasswd -c /etc/apache2/.htpasswd username
# Enter password when prompted
```

**2. Configure virtual host:**
```apache
<Directory /var/www/nanocloud>
    AuthType Basic
    AuthName "NanoCloud Access"
    AuthUserFile /etc/apache2/.htpasswd
    Require valid-user
</Directory>
```

**3. Restart Apache:**
```bash
sudo systemctl restart apache2
```

#### Nginx

**1. Create password file:**
```bash
sudo htpasswd -c /etc/nginx/.htpasswd username
```

**2. Configure server block:**
```nginx
location / {
    auth_basic "NanoCloud Access";
    auth_basic_user_file /etc/nginx/.htpasswd;
}
```

**3. Restart Nginx:**
```bash
sudo systemctl restart nginx
```

**Pros**: Simple, built-in, no code changes  
**Cons**: Shared credentials, no user management, basic security

---

### Option 2: OAuth2 Proxy (Recommended)

Use OAuth2 Proxy to add Google/GitHub/etc authentication.

**1. Install OAuth2 Proxy:**
```bash
wget https://github.com/oauth2-proxy/oauth2-proxy/releases/download/v7.4.0/oauth2-proxy-v7.4.0.linux-amd64.tar.gz
tar -xzf oauth2-proxy-v7.4.0.linux-amd64.tar.gz
sudo mv oauth2-proxy-v7.4.0.linux-amd64/oauth2-proxy /usr/local/bin/
```

**2. Configure OAuth2 Proxy:**
```bash
# /etc/oauth2-proxy.cfg
http_address = "0.0.0.0:4180"
upstreams = ["http://127.0.0.1:8080"]
email_domains = ["yourdomain.com"]
cookie_secret = "GENERATE_RANDOM_SECRET"
client_id = "YOUR_OAUTH_CLIENT_ID"
client_secret = "YOUR_OAUTH_CLIENT_SECRET"
```

**3. Run OAuth2 Proxy:**
```bash
oauth2-proxy --config=/etc/oauth2-proxy.cfg
```

**4. Configure Nginx to proxy through OAuth2:**
```nginx
location / {
    proxy_pass http://127.0.0.1:4180;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

**Pros**: Modern, SSO support, user management  
**Cons**: More complex setup, external dependency

---

### Option 3: Authelia (Advanced)

Full-featured authentication and authorization server.

**Features**:
- Multi-factor authentication (2FA)
- Single sign-on (SSO)
- Access control policies
- LDAP/Active Directory integration

**Setup**: See [Authelia Documentation](https://www.authelia.com/docs/)

**Pros**: Enterprise-grade, highly configurable  
**Cons**: Complex setup, requires Redis/database

---

### Option 4: VPN Access Only

Require VPN connection to access NanoCloud.

**Options**:
- WireGuard (recommended)
- OpenVPN
- Tailscale (easiest)

**Example with Tailscale:**
```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Start Tailscale
sudo tailscale up

# Access NanoCloud via Tailscale IP
http://100.x.x.x
```

**Pros**: Network-level security, simple  
**Cons**: Requires VPN client, network overhead

---

## Hardening Guide

### PHP Security

**php.ini settings:**
```ini
# Disable dangerous functions
disable_functions = exec,passthru,shell_exec,system,proc_open,popen,curl_exec,curl_multi_exec,parse_ini_file,show_source

# Hide PHP version
expose_php = Off

# Disable error display (production)
display_errors = Off
log_errors = On
error_log = /var/log/php-errors.log

# Session security
session.cookie_httponly = 1
session.cookie_secure = 1  # If using HTTPS
session.use_strict_mode = 1
session.cookie_samesite = "Strict"

# File upload limits
upload_max_filesize = 5G
post_max_size = 5G
max_file_uploads = 50

# Resource limits
max_execution_time = 300
memory_limit = 512M
```

---

### Web Server Security

#### Apache

**Enable security modules:**
```bash
sudo a2enmod headers
sudo a2enmod ssl
sudo systemctl restart apache2
```

**Add security headers (.htaccess):**
```apache
# Already included in NanoCloud's .htaccess
Header set X-Content-Type-Options "nosniff"
Header set X-Frame-Options "DENY"
Header set X-XSS-Protection "1; mode=block"
Header set Referrer-Policy "strict-origin-when-cross-origin"
Header set Content-Security-Policy "default-src 'self'"
```

#### Nginx

**Add security headers:**
```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'" always;

# Hide Nginx version
server_tokens off;
```

---

### File System Permissions

**Recommended permissions:**
```bash
# Application files (read-only for web server)
sudo chown -R root:root /var/www/nanocloud
sudo chmod -R 755 /var/www/nanocloud

# Storage directory (writable)
sudo chown -R www-data:www-data /var/www/nanocloud/storage
sudo chmod 755 /var/www/nanocloud/storage

# Configuration (restricted)
sudo chmod 640 /var/www/nanocloud/config/local.php
sudo chown www-data:www-data /var/www/nanocloud/config/local.php

# Sensitive directories (no web access)
sudo chmod 750 /var/www/nanocloud/src
sudo chmod 750 /var/www/nanocloud/config
```

---

### Firewall Configuration

**UFW (Ubuntu):**
```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

**iptables:**
```bash
# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow SSH
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Drop everything else
iptables -A INPUT -j DROP

# Save rules
iptables-save > /etc/iptables/rules.v4
```

---

## Network Security

### HTTPS/TLS Configuration

**Using Let's Encrypt (Free):**
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
# Test renewal
sudo certbot renew --dry-run
```

**Strong TLS configuration (Nginx):**
```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_stapling on;
ssl_stapling_verify on;
```

---

### Rate Limiting

**Nginx rate limiting:**
```nginx
# Define rate limit zone
limit_req_zone $binary_remote_addr zone=nanocloud:10m rate=10r/s;

# Apply to location
location / {
    limit_req zone=nanocloud burst=20 nodelay;
}
```

**Fail2ban for brute force protection:**
```bash
# Install fail2ban
sudo apt install fail2ban

# Configure for NanoCloud
sudo nano /etc/fail2ban/jail.local
```

Add:
```ini
[nanocloud]
enabled = true
port = http,https
filter = nanocloud
logpath = /var/log/nginx/nanocloud-access.log
maxretry = 5
bantime = 3600
```

---

## Monitoring & Auditing

### Access Logging

**Enable detailed logging:**

**Apache:**
```apache
CustomLog ${APACHE_LOG_DIR}/nanocloud-access.log combined
ErrorLog ${APACHE_LOG_DIR}/nanocloud-error.log
```

**Nginx:**
```nginx
access_log /var/log/nginx/nanocloud-access.log combined;
error_log /var/log/nginx/nanocloud-error.log warn;
```

---

### Log Analysis

**Monitor for suspicious activity:**
```bash
# Failed authentication attempts
grep "401" /var/log/nginx/nanocloud-access.log

# Large file uploads
awk '$10 > 1000000000' /var/log/nginx/nanocloud-access.log

# Unusual access patterns
grep -E "\.\./" /var/log/nginx/nanocloud-access.log
```

---

### Automated Monitoring

**Example monitoring script:**
```bash
#!/bin/bash
# /usr/local/bin/nanocloud-monitor.sh

LOG_FILE="/var/log/nginx/nanocloud-access.log"
ALERT_EMAIL="admin@example.com"

# Check for failed auth
FAILED_AUTH=$(grep -c "401" "$LOG_FILE")
if [ "$FAILED_AUTH" -gt 10 ]; then
    echo "High number of failed auth attempts: $FAILED_AUTH" | \
        mail -s "NanoCloud Security Alert" "$ALERT_EMAIL"
fi

# Check disk usage
DISK_USAGE=$(df -h /var/www/nanocloud/storage | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 90 ]; then
    echo "Disk usage critical: ${DISK_USAGE}%" | \
        mail -s "NanoCloud Disk Alert" "$ALERT_EMAIL"
fi
```

**Add to cron:**
```bash
# Run every hour
0 * * * * /usr/local/bin/nanocloud-monitor.sh
```

---

## Incident Response

### Detection

**Signs of compromise:**
- Unexpected files in storage
- High CPU/memory usage
- Unusual network traffic
- Failed authentication spikes
- Modified system files
- Suspicious log entries

---

### Containment

**Immediate actions:**
```bash
# 1. Take system offline
sudo systemctl stop nginx  # or apache2

# 2. Preserve evidence
sudo cp -r /var/log /backup/logs-$(date +%Y%m%d)
sudo cp -r /var/www/nanocloud /backup/nanocloud-$(date +%Y%m%d)

# 3. Block attacker IP
sudo ufw deny from <attacker-ip>

# 4. Change credentials
sudo htpasswd -c /etc/nginx/.htpasswd username
```

---

### Recovery

**Steps:**
1. Identify attack vector
2. Patch vulnerability
3. Restore from clean backup
4. Verify system integrity
5. Monitor for reinfection
6. Document incident

---

### Post-Incident

**Actions:**
- Review and update security measures
- Improve monitoring
- Train users
- Update documentation
- Consider security audit

---

## Compliance Considerations

### GDPR (EU)

**If storing personal data:**
- Document data processing
- Implement data retention policy
- Provide data export capability
- Enable data deletion
- Maintain audit logs
- Implement access controls

---

### HIPAA (Healthcare - US)

**If storing health information:**
- Encrypt data at rest
- Encrypt data in transit (HTTPS)
- Implement access controls
- Maintain audit logs
- Regular security assessments
- Business associate agreements

---

### General Best Practices

**Data Protection:**
```php
// In config/local.php

// Enable encryption at rest (if supported by filesystem)
// Use encrypted storage volume

// Data retention
$DATA_RETENTION_DAYS = 90;  // Auto-delete old files

// Audit logging
$ENABLE_AUDIT_LOG = true;
$AUDIT_LOG_PATH = '/var/log/nanocloud-audit.log';
```

---

## Security Resources

### Tools

- **Security Scanners**: OWASP ZAP, Nikto
- **Vulnerability Scanners**: OpenVAS, Nessus
- **Log Analysis**: ELK Stack, Graylog
- **Intrusion Detection**: Snort, Suricata
- **File Integrity**: AIDE, Tripwire

### References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks/)
- [PHP Security Guide](https://www.php.net/manual/en/security.php)
- [Nginx Security](https://nginx.org/en/docs/http/ngx_http_ssl_module.html)

---

## Support

For security issues:
- **Email**: security@nanocloud.example.com
- **GitHub**: Private security advisories
- **Response Time**: 24-48 hours

**Please report security vulnerabilities responsibly.**

---

## Changelog

- **2026-02-09**: Initial security guide created
- **2026-01-21**: NanoCloud 2.0 released

---

**Remember**: Security is a process, not a product. Regular reviews and updates are essential.
