// Owner UI test with isolated fixtures. No live API requests or data writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/bafna/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const date = '2026-10-06';
const make = (id,workerId,name,toy,step,minutes,pieces,extra={}) => ({id,date,labourId:workerId,workerName:name,toyName:toy,processName:step,minutes,pieces,enteredByName:'Production Admin',note:'',...extra});
let dayEntries = [
  make('a','ankan','Ankanjkumar','Dinosaur','Body assembly',438,500),
  make('b1','badri','Badrinath Mandal. G','Final box packing','All boxs packing',120,15,{isTraining:true,note:'Training on packing'}),
  make('b2','badri','Badrinath Mandal. G','Hen','Head joint',240,400),
  make('b3','badri','Badrinath Mandal. G','Dinosaur','Leg gumming',120,400),
  make('b4','badri','Badrinath Mandal. G','BOPP packing','Dinosaur',180,500),
  make('c','anil','AnilDas','Fighter Jet','Body assembly',498,300)
];
const older = make('older','badri','Badrinath Mandal. G','Fish','Body assembly',120,80,{date:'2026-10-05'});
const errors=[],requests=[];
const metrics=entries=>({pieces:entries.reduce((n,e)=>n+e.pieces,0),hours:entries.reduce((n,e)=>n+e.minutes,0)/60,perHour:0,entries:entries.length,workers:new Set(entries.map(e=>e.labourId)).size});
const report=()=>({from:'2026-10-01',to:date,totals:metrics([...dayEntries,older]),entries:[...dayEntries,older],trend:[],workers:[],flags:[],toys:[],processes:[]});
const day=key=>({date:key,entries:key===date?dayEntries:[],workers:[{id:'badri',name:'Badrinath Mandal. G',status:'present',inTime:'08:30',outTime:'20:30',availableMinutes:660,workedMinutes:660,note:'Shared shift across four tasks'}]});
async function noOverflow(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'No horizontal page overflow');}
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chromium'}),folder=path.resolve(__dirname,'../verification');fs.mkdirSync(folder,{recursive:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{localStorage.setItem('admin_token','isolated-owner');localStorage.setItem('admin_active_tab','production');});
    await page.route('**/*',async route=>{
      const url=new URL(route.request().url());
      if(!url.pathname.startsWith('/api/'))return url.host.includes('googleapis')||url.host.includes('gstatic')?route.abort():route.continue();
      const endpoint=url.pathname.replace('/api','');requests.push({endpoint,method:route.request().method()});let data=[];
      if(endpoint==='/auth/me')data={user:{id:'owner',name:'Owner Test',username:'fixture',role:'owner',permissions:['*']}};
      else if(endpoint==='/production/report')data=report();
      else if(endpoint==='/production/day')data=day(url.searchParams.get('date'));
      else if(endpoint==='/production/masters')data={types:[],toys:[],processes:[],workers:[]};
      else if(endpoint==='/dashboard')data={totalLabourers:3,totalExpenses:0,recentTransactions:[]};
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto('http://localhost:5178');
    const records=page.getByRole('region',{name:'Production records by worker',exact:true});
    await records.waitFor();assert.equal(await records.locator('tbody tr').count(),3);
    const badri=records.locator('tbody tr').filter({hasText:'Badrinath Mandal. G'});assert.equal(await badri.count(),1);assert.match(await badri.innerText(),/11 hr/);assert.match(await badri.innerText(),/1,315/);assert.match(await badri.innerText(),/Multi work/);
    await page.getByRole('heading',{name:'Production records',exact:true}).scrollIntoViewIfNeeded();await noOverflow(page);await page.screenshot({path:path.join(folder,'worker-records-grouped.png')});
    const open=page.getByRole('button',{name:'View work details for Badrinath Mandal. G',exact:true});await open.focus();await open.press('Enter');
    await page.getByRole('heading',{name:'Badrinath Mandal. G',exact:true}).waitFor();assert.equal(new URL(page.url()).searchParams.get('productionWorker'),'id:badri');
    const details=page.getByRole('region',{name:'Production records, scroll for all columns',exact:true});assert.equal(await details.locator('tbody tr').count(),4);assert.equal(await page.getByRole('heading',{name:'Production records',exact:true}).count(),0);
    assert.ok((await details.locator('tfoot').innerText()).includes('1,315 pcs'));assert.ok((await details.locator('tfoot').innerText()).includes('11 hr'));assert.ok((await page.locator('.production-metric').filter({hasText:'Total pcs'}).innerText()).includes('1,315'));
    for(const text of ['Final box packing','Head joint','Leg gumming','BOPP packing','Training on packing'])assert.ok((await details.innerText()).includes(text));
    assert.equal(await details.getByText('Production Admin',{exact:true}).count(),4);await noOverflow(page);await page.screenshot({path:path.join(folder,'worker-work-details.png')});
    await page.reload();await page.getByRole('heading',{name:'Badrinath Mandal. G',exact:true}).waitFor();assert.equal(await details.locator('tbody tr').count(),4);
    await page.getByRole('button',{name:'Back to production records',exact:true}).click();await records.waitFor();assert.equal(await page.getByLabel('Record date',{exact:true}).inputValue(),date);
    await open.click();await page.goBack();await records.waitFor();await page.goForward();await page.getByRole('heading',{name:'Badrinath Mandal. G',exact:true}).waitFor();await page.getByRole('button',{name:'Back to production records',exact:true}).click();await records.waitFor();
    await page.getByLabel('Show records',{exact:true}).selectOption('period');await records.waitFor();await open.click();await page.getByRole('heading',{name:'Badrinath Mandal. G',exact:true}).waitFor();assert.equal(await details.locator('tbody tr').count(),5);assert.ok((await details.innerText()).includes('5 Oct 2026'));await page.getByRole('button',{name:'Back to production records',exact:true}).click();await records.waitFor();assert.equal(await page.getByLabel('Show records',{exact:true}).inputValue(),'period');
    await page.getByLabel('Show records',{exact:true}).selectOption('day');await records.waitFor();
    const performer=page.getByRole('button',{name:'View performance details for Badrinath Mandal. G',exact:true});await performer.focus();await performer.press('Enter');await page.getByRole('heading',{name:'Badrinath Mandal. G',exact:true}).waitFor();assert.equal(await details.locator('tbody tr').count(),5);assert.equal(new URL(page.url()).searchParams.get('productionSource'),'leaders');assert.ok((await details.locator('tfoot').innerText()).includes('1,395 pcs'));await page.reload();await page.getByRole('button',{name:'Back to top performers',exact:true}).click();await performer.waitFor();assert.equal(await page.getByLabel('Show records',{exact:true}).inputValue(),'day');await page.getByRole('heading',{name:'Top performers',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(folder,'top-performers-clickable.png')});
    await page.setViewportSize({width:375,height:812});await page.getByRole('heading',{name:'Production records',exact:true}).scrollIntoViewIfNeeded();await noOverflow(page);await page.screenshot({path:path.join(folder,'worker-records-mobile.png')});await open.click();await page.getByRole('heading',{name:'Badrinath Mandal. G',exact:true}).waitFor();await noOverflow(page);await page.screenshot({path:path.join(folder,'worker-details-mobile.png')});
    dayEntries=dayEntries.filter(entry=>entry.labourId!=='badri');await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByRole('heading',{name:'No work records in this selection',exact:true}).waitFor();await page.getByRole('button',{name:'Back to production records',exact:true}).click();await records.waitFor();assert.equal(await records.locator('tbody tr').count(),2);
    dayEntries.push(make('same1','same-one','Same Name','Fish','Body assembly',60,10),make('same2','same-two','Same Name','Hen','Head joint',60,20));await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('[aria-label="Production records by worker"] tbody tr').length===4);assert.equal(await records.locator('tbody tr').filter({hasText:'Same Name'}).count(),2);
    assert.ok(requests.every(request=>request.method==='GET'),'Owner remains read-only');assert.deepEqual(errors,[]);
    console.log('PASS: 6 entries grouped into 3 worker rows, 4-task detail page, totals, keyboard open, URL/reload, browser back/forward, filter preservation, period dates, mobile, missing worker and distinct same-name IDs; no owner writes or runtime errors.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
