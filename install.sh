#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${SERVERDOCK_REPO_URL:-https://github.com/xoxma1993/ServerDock.git}"
INSTALL_DIR="/opt/serverdock"
NODE_VERSION_MAJOR_REQUIRED=20

echo "==> ServerDock installer starting..."

if [[ $EUID -ne 0 ]]; then
  echo "This installer must be run as root (sudo)." >&2
  exit 1
fi

if ! command -v lsb_release >/dev/null 2>&1; then
  echo "Installing lsb-release..."
  apt-get update -y
  apt-get install -y lsb-release
fi

DISTRO=$(lsb_release -is 2>/dev/null || echo "Ubuntu")
RELEASE=$(lsb_release -rs 2>/dev/null || echo "24.04")

echo "Detected OS: ${DISTRO} ${RELEASE}"

install_node() {
  if command -v node >/dev/null 2>&1; then
    CURRENT_MAJOR=$(node -v | sed -E 's/^v([0-9]+).*/\1/')
    if [[ "$CURRENT_MAJOR" -ge "$NODE_VERSION_MAJOR_REQUIRED" ]]; then
      echo "Node.js $(node -v) already installed (>= ${NODE_VERSION_MAJOR_REQUIRED}), skipping Node install."
      return
    else
      echo "Existing Node.js version is too old ($(node -v)), upgrading..."
    fi
  else
    echo "Node.js not found, installing Node.js ${NODE_VERSION_MAJOR_REQUIRED}..."
  fi

  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION_MAJOR_REQUIRED}.x | bash -
  apt-get install -y nodejs
}

install_pm2() {
  if command -v pm2 >/dev/null 2>&1; then
    echo "pm2 already installed."
  else
    echo "Installing pm2 globally..."
    npm install -g pm2
  fi
}

clone_repo() {
  echo "Cloning ServerDock repository..."
  if [[ -d "${INSTALL_DIR}" ]]; then
    echo "Directory ${INSTALL_DIR} already exists. Updating existing install..."
    cd "${INSTALL_DIR}"
    if command -v git >/dev/null 2>&1; then
      git pull --rebase || true
    else
      echo "git is not installed; cannot update existing repository automatically." >&2
    fi
  else
    apt-get update -y
    apt-get install -y git
    git clone "${REPO_URL}" "${INSTALL_DIR}"
    cd "${INSTALL_DIR}"
  fi
}

generate_env() {
  cd "${INSTALL_DIR}"

  if [[ -f ".env" ]] && grep -q '^PORT=' .env && grep -q '^SECRET_TOKEN=' .env && grep -q '^JWT_SECRET=' .env; then
    echo ".env already exists with required keys, keeping existing configuration."
    return
  fi

  echo "Generating .env file..."

  # openssl rand -hex generates an exact-length hex string with NO pipes — zero SIGPIPE risk
  # 16 bytes hex = 32 chars, 24 bytes hex = 48 chars
  SECRET_TOKEN=$(openssl rand -hex 16)
  JWT_SECRET=$(openssl rand -hex 24)

  # Fallbacks in case openssl is somehow unavailable
  if [[ -z "${SECRET_TOKEN}" ]]; then
    SECRET_TOKEN="serverdock_$(date +%s)_$RANDOM"
  fi
  if [[ -z "${JWT_SECRET}" ]]; then
    JWT_SECRET="serverdock_jwt_$(date +%s)_$RANDOM"
  fi

  # Write atomically to avoid corrupted .env if the script is interrupted
  TMP_ENV=".env.tmp.$$"

  cat > "${TMP_ENV}" <<EOF
PORT=2580
SECRET_TOKEN=${SECRET_TOKEN}
JWT_SECRET=${JWT_SECRET}
EOF

  # If user provided a public domain for ServerDock, persist it into .env
  # so we can show nicer URLs in the banner (e.g. https://dp.w3lnet.com).
  if [[ -n "${SERVERDOCK_DOMAIN:-}" ]]; then
    echo "SERVERDOCK_DOMAIN=${SERVERDOCK_DOMAIN}" >> "${TMP_ENV}"
  fi

  mv "${TMP_ENV}" .env

  echo "${SECRET_TOKEN}" > .serverdock_token

  echo ".env successfully created."
}

install_dependencies() {
  cd "${INSTALL_DIR}"
  echo "Installing system build tools required for native Node modules..."

  if ! command -v make >/dev/null 2>&1; then
    echo "Installing build-essential (make, g++ and related tools)..."
    apt-get update -y
    apt-get install -y build-essential
  fi

  echo "Installing ServerDock npm dependencies..."
  npm install --production=false
}

build_frontend() {
  cd "${INSTALL_DIR}/client"
  echo "Installing frontend dependencies..."
  npm install --production=false

  echo "Building frontend into ${INSTALL_DIR}/public..."
  npm run build
}

setup_nginx_https_ip() {
  # Optional: front ServerDock with Nginx + self‑signed HTTPS on the server IP,
  # similar to how HestiaCP works without a domain.
  # Enable by setting SERVERDOCK_ENABLE_HTTPS_IP=1 (default 0 to avoid conflicts).
  if [[ "${SERVERDOCK_ENABLE_HTTPS_IP:-0}" != "1" ]]; then
    echo "Skipping Nginx HTTPS/IP setup (set SERVERDOCK_ENABLE_HTTPS_IP=1 to enable)."
    return
  fi

  echo "Setting up Nginx HTTPS reverse proxy on port 443 for ServerDock..."

  apt-get update -y
  apt-get install -y nginx openssl

  SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  if [[ -z "${SERVER_IP}" ]]; then
    SERVER_IP="127.0.0.1"
  fi

  CERT_PATH="/etc/ssl/certs/serverdock.crt"
  KEY_PATH="/etc/ssl/private/serverdock.key"

  if [[ ! -f "${CERT_PATH}" || ! -f "${KEY_PATH}" ]]; then
    echo "Generating self-signed TLS certificate for IP ${SERVER_IP}..."
    openssl req -x509 -nodes -days 365 \
      -newkey rsa:2048 \
      -keyout "${KEY_PATH}" \
      -out "${CERT_PATH}" \
      -subj "/CN=${SERVER_IP}" \
      -addext "subjectAltName = IP:${SERVER_IP}"
  else
    echo "Existing TLS certificate found at ${CERT_PATH}, reusing."
  fi

  SITE_CONF="/etc/nginx/sites-available/serverdock"

  cat > "${SITE_CONF}" <<EOF
server {
    listen 80;
    server_name ${SERVER_IP};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${SERVER_IP};

    ssl_certificate     ${CERT_PATH};
    ssl_certificate_key ${KEY_PATH};

    ssl_protocols TLSv1.2 TLSv1.3;

    # HTTP (REST + static assets)
    location / {
        proxy_pass http://127.0.0.1:2580;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # WebSocket terminal: /ws/terminal?token=<jwt>
    location /ws/ {
        proxy_pass http://127.0.0.1:2580;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

  ln -s "${SITE_CONF}" /etc/nginx/sites-enabled/serverdock 2>/dev/null || true
  if [[ -f /etc/nginx/sites-enabled/default ]]; then
    rm -f /etc/nginx/sites-enabled/default
  fi

  nginx -t
  systemctl reload nginx

  echo "Nginx HTTPS/IP frontend configured. You can now access ServerDock via:"
  echo "  https://${SERVER_IP}/"
}

start_serverdock() {
  cd "${INSTALL_DIR}"
  echo "Starting ServerDock with pm2..."
  pm2 start server.js --name serverdock || pm2 restart serverdock
  pm2 save || true
}

print_banner() {
  cd "${INSTALL_DIR}"
  if [[ -f ".serverdock_token" ]]; then
    SECRET_TOKEN_SHOWN=$(cat .serverdock_token)
  else
    SECRET_TOKEN_SHOWN=$(grep -E '^SECRET_TOKEN=' .env | cut -d'=' -f2- || echo "<SET_IN_ENV>")
  fi

  SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  if [[ -z "${SERVER_IP}" ]]; then
    SERVER_IP="YOUR_SERVER_IP"
  fi

   # Prefer a configured public domain if available, otherwise fall back to IP.
   SERVER_HOST="${SERVERDOCK_DOMAIN:-${SERVER_IP}}"

   # If we have an HTTPS/IP frontend via Nginx, show the HTTPS URL without port.
   if [[ "${SERVERDOCK_ENABLE_HTTPS_IP:-0}" == "1" ]]; then
     URL_SCHEME="https"
     URL_PORT=""
   else
     URL_SCHEME="http"
     URL_PORT=":2580"
   fi

  cat <<EOF
╔══════════════════════════════════════════════════════════╗
║  ServerDock is running!                                  ║
║  Open: ${URL_SCHEME}://${SERVER_HOST}${URL_PORT}/?token=${SECRET_TOKEN_SHOWN}  ║
║  (Token is embedded in the URL for first login)          ║
╚══════════════════════════════════════════════════════════╝
EOF
}

install_node
install_pm2
clone_repo
generate_env
install_dependencies
build_frontend
setup_nginx_https_ip
start_serverdock
print_banner

echo "Installation complete."   