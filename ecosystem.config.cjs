// PM2 process for the VPS (see CLAUDE.md). First start: `pm2 start ecosystem.config.cjs && pm2 save`.
// Nginx proxies vibelydate.com → 127.0.0.1:3000.
module.exports = {
  apps: [
    {
      name: 'vibely',
      cwd: '/var/www/vibely',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000 -H 127.0.0.1',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '800M',
      time: true,
    },
  ],
}
