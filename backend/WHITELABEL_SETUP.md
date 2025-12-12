# Whitelabel Nginx Configuration Setup

This document outlines the necessary server-side configuration to enable automatic Nginx reverse proxy creation for whitelabel tenants.

## Prerequisites

- **OS**: Linux (Ubuntu/Debian recommended)
- **Web Server**: Nginx
- **DNS**: Wildcard A record (e.g., `*.aiassistant.net`) pointing to `31.97.100.189`.
- **Frontend Path**: Ensure your frontend build is located at `/var/www/aiassistant-frontend`.

## 1. SUDO Permissions

The Node.js application needs permission to run the setup script with `sudo` without a password prompt.

1. SSH into your server:
   ```bash
   ssh root@31.97.100.189
   ```

2. Edit the sudoers file:
   ```bash
   sudo visudo
   ```

3. Add the following line to the bottom of the file (replace `root` with the user running your Node app if it's different):

   ```
   root ALL=(ALL) NOPASSWD: /path/to/your/voiceagents/backend/scripts/setup_reverse_proxy.sh
   ```
   
   *Tip: To find the full path, navigate to the directory and run `pwd`.*

## 2. DNS Configuration

**CRITICAL**: You must add a Wildcard DNS record in your domain provider settings.

- **Type**: A Record
- **Host**: `*` (or `*.aiassistant.net`)
- **Value**: `31.97.100.189`

This ensures that any subdomain (e.g., `client1.aiassistant.net`) resolves to your server, allowing Nginx to handle the request.

## 3. Verify Functionality

1. **Restart your backend** to apply the code changes.
2. **Create a whitelabel user** (via signup or admin panel).
3. **Check logs**:
   - Backend logs should show: `🚀 Setting up Nginx reverse proxy for ...`
   - If successful: `✅ Nginx reverse proxy setup completed ...`
