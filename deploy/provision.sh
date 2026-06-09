#!/usr/bin/env bash
# One-time provisioning of a fresh Ubuntu 22.04/24.04 host: installs Docker +
# Compose plugin and a non-root deploy user. Run as root:  bash provision.sh
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"

echo "==> Installing Docker Engine + Compose plugin"
apt-get update -y
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "==> Ensuring a 2G swap file (OOM safety on a 4 GB box)"
if [ ! -f /swapfile ] && ! swapon --show | grep -q .; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "    swap enabled."
else
  echo "    swap already present, skipping."
fi

echo "==> Creating deploy user '${DEPLOY_USER}'"
id -u "${DEPLOY_USER}" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "${DEPLOY_USER}"
usermod -aG docker "${DEPLOY_USER}"
mkdir -p "/home/${DEPLOY_USER}/.ssh" "/home/${DEPLOY_USER}/app"
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "/home/${DEPLOY_USER}/.ssh" "/home/${DEPLOY_USER}/app"

echo "==> Done."
echo "Next:"
echo "  1) Add your CI deploy public key to /home/${DEPLOY_USER}/.ssh/authorized_keys"
echo "  2) Point DNS A/AAAA records (teamly + agent subdomains) at this host"
echo "  3) Set the GitHub Actions secrets (see deploy/README.md) and push to main"
