// PM2 process manager config for xtcms
// Usage: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'xtcms',
    script: 'dist/server/entry.mjs',
    node_args: '--env-file=.env',
    // Auto-restart when template switch triggers rebuild
    watch: ['.xtcms/needs-restart'],
    watch_delay: 3000,
    // Restart after rebuild completes
    max_restarts: 10,
    restart_delay: 2000,
  }],
};
