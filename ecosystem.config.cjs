// PM2 process on the VPS (user `deploy`). Releases live in /var/www/vibely/releases/<id>;
// `current` points to the live one (see scripts/deploy/activate.sh). Nginx proxies to 127.0.0.1:3000.
module.exports = {
  apps: [
    {
      name: 'vibely',
      cwd: '/var/www/vibely/current',
      script: '/var/www/vibely/current/server.js',
      // Runtime secrets stay on the server, outside any release directory.
      node_args: '--env-file=/var/www/vibely/shared/.env.production',
      env: { NODE_ENV: 'production', PORT: '3000', HOSTNAME: '127.0.0.1' },
      max_memory_restart: '600M',
      time: true,
    },
  ],
}
