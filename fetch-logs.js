const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  conn.exec('pm2 logs flag-game-backend --lines 100 --nostream', (err, stream) => {
    if (err) throw err;
    stream.on('close', () => { conn.end(); })
          .on('data', (data) => { console.log(data.toString()); })
          .stderr.on('data', (data) => { console.error(data.toString()); });
  });
}).connect({
  host: '193.164.4.57',
  port: 22,
  username: 'akif',
  password: 'L0calappdata'
});
