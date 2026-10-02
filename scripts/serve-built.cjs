// Serve the included review build using Node.js only; no npm install required.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '_site');
const port = Number(process.env.PORT || 8080);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.json':'application/json','.xml':'application/xml','.svg':'image/svg+xml',
  '.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.txt':'text/plain','.webmanifest':'application/manifest+json'};
http.createServer((request,response)=>{
  let filename;
  try {
    const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    const candidate=path.resolve(root,'.'+pathname);
    if(candidate!==root&&!candidate.startsWith(root+path.sep)){response.writeHead(403);response.end('Forbidden');return;}
    filename=[candidate,candidate+'.html',path.join(candidate,'index.html')].find(file=>fs.existsSync(file)&&fs.statSync(file).isFile());
  } catch (_) {response.writeHead(400);response.end('Bad request');return;}
  if(!filename){response.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});response.end(fs.readFileSync(path.join(root,'404.html')));return;}
  response.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(filename).pipe(response);
}).listen(port,'127.0.0.1',()=>console.log(`Figade review: http://localhost:${port}\nPress Ctrl+C to stop.`)).on('error',error=>{
  console.error(error.code==='EADDRINUSE'?`Port ${port} is already in use. Close the other local preview and try again.`:error.message);process.exit(1);
});
