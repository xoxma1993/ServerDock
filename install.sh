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

  # Treat empty or obviously incomplete .env as missing (handles interrupted runs)
  if [[ -f ".env" ]] && grep -q '^PORT=' .env && grep -q '^SECRET_TOKEN=' .env && grep -q '^JWT_SECRET=' .env; then
    echo ".env already exists with required keys, keeping existing configuration."
    return
  fi

  echo "Generating .env file..."
  SECRET_TOKEN=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)
  JWT_SECRET=$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 48)

  # Write atomically to avoid corrupted .env if the script is interrupted
  TMP_ENV=".env.tmp.$$"

  cat > "${TMP_ENV}" <<EOF
PORT=2580
SECRET_TOKEN=${SECRET_TOKEN}
JWT_SECRET=${JWT_SECRET}
EOF

  mv "${TMP_ENV}" .env

  echo "${SECRET_TOKEN}" > .serverdock_token
}

install_dependencies() {
  cd "${INSTALL_DIR}"
  echo "Installing system build tools required for native Node modules..."

  # node-pty (and other native deps) need make/g++ and friends
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

  cat <<EOF
╔══════════════════════════════════════════════════════════╗
║  ServerDock is running!                                  ║
║  Open: http://${SERVER_IP}:2580/?token=${SECRET_TOKEN_SHOWN}  ║
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
start_serverdock
print_banner

echo "Installation complete."