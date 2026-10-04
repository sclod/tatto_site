// pm2: pm2 start ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: 'valova',
      script: 'server/server.mjs',
      cwd: __dirname,
      // секреты и настройки — из .env (Node ≥ 20.6 читает его сам)
      node_args: '--env-file=.env',
      instances: 1, // лимит частоты заявок хранится в памяти — один процесс
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '250M',
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 6000,
      restart_delay: 2000,
      max_restarts: 20,
      time: true,
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      merge_logs: true,
    },
  ],
};
