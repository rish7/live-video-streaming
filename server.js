const webSocket = require('ws');
const express = require('express')
const child_process = require('child_process');

let clients = []
const app = express()
app.use(express.static('public'))
var cors = require('cors')

app.get('/healthcheck', function (req, res) {
  res.send(`I am healthy, current time in server is ${new Date().toISOString()}`)
})
app.options('*', cors())

app.get('/api/video', function (req, res) {
  res.writeHead(200, {
    "Content-Type": "video/webm",
    'Transfer-Encoding': 'chunked'
  });
  // Add the response to the clients array to receive streaming
  clients.push(res);
  console.log('Http client connected: Streaming!');
});

app.listen(3000)
console.log("HTTP Service: http://localhost:3000/")

const wss = new webSocket.Server({ port: 8080 });
console.log("Web Socket Service: ws://localhost:8080/")

function noop() { }

function heartbeat() {
  this.isAlive = true;
}

wss.on('connection', function connection(ws) {
  ws.isAlive = true;
  ws.on('pong', heartbeat);
  ws.on('message', function (data) {
    // Actual HTTP audio Streaming
    if (clients.length > 0) {
      //console.log(new Date().toISOString(), "[http("+clients.length+")]");
      
      //Web Socket write request data directly
      for (var client in clients){
        clients[client].write(data); // Sending ws data back
      }

      //To modify video using ffmpeg use this line instead of  sending ws data (here e.g. for adding logo)
      //ffmpeg.stdin.write(data);
    }
  });
  ws.send('ready');

  //Below ffmpeg lines need only if we plan to edit them
  const ffmpeg = child_process.spawn('ffmpeg', [
    '-i', 'pipe:0',
    '-i', __dirname + '/public/logo.png',
    '-filter_complex', "overlay=490:390",
    '-f', 'webm',
    '-cluster_size_limit', '2M',
    '-cluster_time_limit', '5100',
    '-content_type', 'video/webm',
    //'-vf', 'scale=1280:-1',
    '-r', '30',
    '-ac', '2',
    '-acodec', 'libopus',
    '-b:a', '96K',
    '-vcodec', 'libvpx',
    '-b:v', '2.5M',
    '-crf', '30',
    '-g', '150',
    '-deadline', 'realtime',
    '-threads', '8',
    'pipe:1'
  ]);
  
  ffmpeg.stderr.on('data', function (data) {
    console.log('ffmpeg stderr data = ' + data); //On error kill the web socket
  });

  ffmpeg.stdout.on('data', function (chunk) {
    for (var client in clients) {
      clients[client].write(chunk); // Sending ffmpeg data back
    }
  });
});

const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping(noop);
  });
}, 30000);

wss.on('close', function close() {
  clearInterval(interval);
});