// Isolated read-only owner report verification. No factory data is sent.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/bafna/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const date='2026-10-06';
const entries=[{id:'a',date,labourId:'a',workerName:'Ankanjkumar',processId:'body',toyName:'Dinosaur',processName:'Body assembly',minutes:438,pieces:500,enteredByName:'Production Admin',note:''},{id:'b',date,labourId:'b',workerName:'Badrinath Mandal. G',processId:'head',toyName:'Hen',processName:'Head joint',minutes:240,pieces:400,enteredByName:'Production Admin',note:''},{id:'c',date,labourId:'b',workerName:'Badrinath Mandal. G',processId:'gum',toyName:'Dinosaur',processName:'Leg gumming',minutes:120,pieces:400,enteredByName:'Production Admin',note:''}];
const processes=entries.map(entry=>({id:entry.processId,name:entry.processName,toyName:entry.toyName,pieces:entry.pieces,minutes:entry.minutes,hours:entry.minutes/60,perHour:entry.pieces*60/entry.minutes}));
const masters={types:[],toys:[],workers:[],processes:[{id:'body',targetPerHour:50},{id:'head',targetPerHour:100},{id:'gum',targetPerHour:250}]};
let empty=false;const requests=[],errors=[];
const report=()=>({from:date,to:date,totals:{pieces:empty?0:1300,hours:empty?0:13.3,perHour:98,entries:empty?0:3,workers:2},entries:empty?[]:entries,processes:empty?[]:processes,toys:[{id:'removed',name:'Must not show',pieces:1300,hours:13.3,perHour:98}],trend:empty?[]:[{date,pieces:1300,hours:13.3,perHour:98,workers:2}],workers:[],flags:[],records:[]});
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chromium'}),folder=path.resolve(__dirname,'../verification');fs.mkdirSync(folder,{recursive:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});page.on('pageerror',error=>{errors.push(error.message);console.error('UI error:',error.message);});
    await page.addInitScript(()=>{localStorage.setItem('admin_token','isolated');localStorage.setItem('admin_active_tab','production');});
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());if(!url.pathname.startsWith('/api/'))return /googleapis|gstatic/.test(url.host)?route.abort():route.continue();
      const endpoint=url.pathname.replace('/api','');requests.push(route.request().method());let data=[];
      if(endpoint==='/auth/me')data={user:{name:'Owner Test',role:'owner',username:'fixture',permissions:['*']}};
      else if(endpoint==='/production/report')data=report();
      else if(endpoint==='/production/day')data={date,entries,workers:[]};
      else if(endpoint==='/production/masters')data=masters;
      else if(endpoint==='/dashboard')data={totalLabourers:2,recentTransactions:[],totalExpenses:0};
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto('http://localhost:5178');const section=page.locator('.production-work-output');await section.locator('.production-output-summary').getByText('1,300',{exact:true}).waitFor();
    assert.equal(await page.getByRole('heading',{name:'Output by toy',exact:true}).count(),0);assert.equal(await section.locator('ol > li').count(),3);
    assert.ok((await section.locator('ol > li').first().innerText()).includes('Body assembly'));assert.ok((await section.locator('.production-output-summary').innerText()).includes('13 hr 18 min'));
    const bounds=await section.boundingBox(),parent=await page.locator('.production-page').boundingBox();assert.ok(Math.abs(bounds.width-parent.width)<3);
    await section.screenshot({path:path.join(folder,'output-work-step-desktop.png')});
    const search=section.getByLabel('Search work steps',{exact:true});await search.fill('Dinosaur');assert.equal(await section.locator('ol > li').count(),2);await section.getByText('2 of 3 work steps',{exact:true}).waitFor();
    await search.fill('No such work');await section.getByText('No work steps match this search.',{exact:true}).waitFor();await search.fill('');assert.equal(await section.locator('ol > li').count(),3);
    await section.locator('summary').click();await section.getByRole('region',{name:'Day by day totals',exact:true}).waitFor();await section.locator('summary').click();
    await page.setViewportSize({width:375,height:812});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));await section.screenshot({path:path.join(folder,'output-work-step-mobile.png')});
    empty=true;await page.getByRole('button',{name:'Refresh',exact:true}).click();await section.getByText('No work step output recorded in this period.',{exact:true}).waitFor();assert.equal(await section.locator('ol > li').count(),0);
    assert.deepEqual(errors,[]);assert.ok(requests.every(method=>method==='GET'));console.log('PASS: toy output removed; full-width work output; sorted rows, 1,300pcs / 13hr18 totals, toy/work search, daily data, mobile, empty state; no owner writes or runtime errors.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
