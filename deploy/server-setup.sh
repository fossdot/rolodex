#!/bin/bash
# Run this as root on a fresh Ubuntu 22.04/24.04 Linode.
# Sets up Caddy, Node.js, PocketBase, and the Rolodex app.
set -e

REPO="https://github.com/fossdot/rolodex.git"
APP_DIR="/opt/rolodex"
PB_VERSION="0.39.1"
NODE_VERSION="20"
APP_USER="rolodex"

echo "==> Creating app user"
id "$APP_USER" &>/dev/null || useradd -m -s /bin/bash "$APP_USER"

echo "==> Firewall"
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable

echo "==> Installing Caddy"
apt-get update
apt-get install -y curl gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy

echo "==> Installing Node.js $NODE_VERSION"
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

echo "==> Cloning repo"
git clone "$REPO" "$APP_DIR" 2>/dev/null || git -C "$APP_DIR" pull

echo "==> Downloading PocketBase v$PB_VERSION"
cd "$APP_DIR/pocketbase"
curl -L -o pb.zip \
  "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip"
unzip -o pb.zip pocketbase
chmod +x pocketbase
rm pb.zip

echo "==> Building frontend"
cd "$APP_DIR/frontend"
npm ci
npm run build

echo "==> Setting ownership"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> Installing Caddy config"
cp "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
systemctl reload caddy

echo "==> Installing systemd services"
cp "$APP_DIR/deploy/pocketbase.service" /etc/systemd/system/
cp "$APP_DIR/deploy/sveltekit.service"  /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now pocketbase sveltekit

echo ""
echo "Done. Next steps:"
echo "  1. Point rolodex.fossunited.org DNS A record to this server's IP"
echo "  2. Open http://localhost:8090/_/ via SSH tunnel to create the superadmin"
echo "     (ssh -L 8090:localhost:8090 root@<this-server-ip>)"
echo "  3. Run: node $APP_DIR/pocketbase/setup.js <email> <password>"
echo "  4. Configure SMTP in PocketBase admin → Settings → Mail settings"
