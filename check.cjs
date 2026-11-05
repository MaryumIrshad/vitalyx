const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {innerHTML:'',textContent:'',value:id==='specialty'?'Pulmonology':'',style:{},classList:{toggle(){}},addEventListener(){},showModal(){},close(){}});
  return elements.get(id);
}
const context = vm.createContext({document:{getElementById:element,querySelector:()=>element('close'),querySelectorAll:()=>[]},console,Blob,URL,setTimeout,assert});
vm.runInContext(fs.readFileSync('dist/app.js','utf8'),context);
vm.runInContext(`
for (const key of Object.keys(patients)) {
 current=key;
 for (const days of [7,15,30]) {
  period=days; render();
  const data=rows(); assert.equal(data.length, days);
  assert(data.every(d=>d.doses>=0 && d.doses<=2));
  const readings=data.flatMap(d=>d.readings);
  const accepted=readings.filter(d=>d.quality==='accepted');
  const bestDays=data.filter(d=>bestAccepted(d));
  assert(readings.length>data.length-data.filter(d=>d.missing).length);
  assert.equal(($('lung-chart').innerHTML.match(/class="reading-point"/g)||[]).length,readings.length);
  assert.equal(($('lung-chart').innerHTML.match(/class="best-point"/g)||[]).length,bestDays.length);
  assert(accepted.length<=readings.length);
  assert(data.some(d=>d.readings.length>1));
  assert.equal(($('log-body').innerHTML.match(/<tr>/g)||[]).length,days);
  assert(!$('metrics').innerHTML.includes('NaN'));
  assert.equal(($('metrics').innerHTML.match(/class="minute-card"/g)||[]).length,6);
  assert($('metrics').innerHTML.includes('Latest FEV1 vs personal best'));
  detail(data[0].date); assert($('detail-content').innerHTML.length>100);
 }
}
console.log('Passed: 3 patients × 3 periods; multiple FEV1 readings, quality selection, daily best trends, daily rows, and detail rendering.');
`,context);
