const path=require('node:path');
const {chromium}=require('C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:8766/output/exclusive-tea-v1/preview.html?capture=1');
 await page.waitForFunction(()=>window.assetReady||window.assetError,{timeout:60000});
 if(await page.evaluate(()=>window.assetError))throw new Error(await page.evaluate(()=>window.assetError));
 for(const view of ['hero','front','side','top']){
   await page.evaluate(v=>window.assetPreview.setView(v),view);
   await page.screenshot({path:path.resolve(__dirname,'..',`preview-${view}.png`)});
 }
 await page.evaluate(()=>{window.assetPreview.model.getObjectByName('Tea').visible=false;window.assetPreview.setView('top')});
 await page.screenshot({path:path.resolve(__dirname,'..','preview-hollow.png')});
 await page.evaluate(()=>{window.assetPreview.model.getObjectByName('Tea').visible=true;window.assetPreview.setNeutral(true);window.assetPreview.setView('hero')});
 await page.screenshot({path:path.resolve(__dirname,'..','preview-neutral.png')});
 console.log(JSON.stringify({browserErrors:errors,meshNames:await page.evaluate(()=>window.assetPreview.model.children[0]?.children.map(x=>x.name)||window.assetPreview.model.children.map(x=>x.name))},null,2));
 await browser.close();
 if(errors.length)process.exitCode=1;
})().catch(error=>{console.error(error);process.exit(1)});
