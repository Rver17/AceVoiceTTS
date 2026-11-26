import { _electron as electron } from "playwright-core";
import { build } from "esbuild";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const profile=await fs.mkdtemp(path.join(os.tmpdir(),"ace-frame-test-"));
const bundle=(await build({stdin:{contents:'export {Recognition} from "./src/recognition";export {findDialoguePanel} from "./src/dialoguePanel";',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',globalName:'Reader'})).outputFiles[0].text;
const env={...process.env,ACEVOICE_PORT:"18775"}; delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[".","--user-data-dir="+profile],env});
try {
const page=await app.firstWindow();
for (const file of process.argv.slice(2)){
const data=(await fs.readFile(file)).toString("base64");
const result=await page.evaluate(async({bundle,data})=>{
const reader=new Function(bundle+";return Reader")();
const im=new Image();im.src='data:image/png;base64,'+data;await im.decode();
const c=document.createElement('canvas'); c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);Object.assign(c,{videoWidth:c.width,videoHeight:c.height,readyState:4});
return {panel:reader.findDialoguePanel(c), result:await new reader.Recognition().read(c,{dialogueBox:{x:.1,y:.73,w:.8,h:.2},speakerNameBox:{x:.08,y:.65,w:.26,h:.08}},1.5)};
},{bundle,data}); console.log(JSON.stringify(result));}
} finally {await app.close();await fs.rm(profile,{recursive:true,force:true,maxRetries:4,retryDelay:250});}
