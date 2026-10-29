// Dependency-free preview server. GitHub Pages serves these same files.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const portArg=process.argv.indexOf('--port');
const root=process.cwd(), port=Number(portArg>=0?process.argv[portArg+1]:process.env.PORT)||3000;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
http.createServer(async(req,res)=>{
  try{
    const url=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const path=resolve(root,'.'+url+(url.endsWith('/')?'index.html':''));
    if(!path.startsWith(root+sep)||url.includes('/.')){res.writeHead(403);res.end();return;}
    if(!(await stat(path)).isFile())throw Error();
    const body=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(body);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'0.0.0.0',()=>process.stdout.write(`School Navigator listening on ${port}\n`));
