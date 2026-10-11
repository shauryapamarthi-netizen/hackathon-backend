const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'dist');
http.createServer((req,res)=>{
 if(req.url==='/train-feedback'&&req.method==='POST'){
  let body='';
  req.on('data',chunk=>{body+=chunk;if(body.length>4096){res.writeHead(413);res.end();req.destroy();}});
  req.on('end',async()=>{
   if(res.writableEnded)return;
   let parsed;try{parsed=JSON.parse(body)}catch{res.writeHead(400);res.end();return}
   const result=await require('./lib/train-feedback').trainingFeedback(parsed);
   res.writeHead(result.status,{'Content-Type':'application/json'});res.end(JSON.stringify(result.body));
  });
  return;
 }

 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);res.end();return}
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}
 fs.readFile(file,(error,data)=>{res.writeHead(error?404:200,{'Content-Type':file.endsWith('.png')?'image/png':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.css')?'text/css':(/\.m?js$/.test(file))?'text/javascript':'text/html'});res.end(error?'Not found':data)});
}).listen(4173,'127.0.0.1',()=>console.log('Open http://127.0.0.1:4173 in your browser. Press Ctrl+C to stop.'));


