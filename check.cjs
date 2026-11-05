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
 for (const days of [7,14,30]) {
  period=days; render();
  const data=rows(); assert.equal(data.length, days);
  assert(data.every(d=>d.doses>=0 && d.doses<=2));
  const accepted=data.filter(d=>d.fev!==null&&d.quality==='accepted');
  assert.equal(($('lung-chart').innerHTML.match(/<circle /g)||[]).length,accepted.length);
  assert.equal(($('log-body').innerHTML.match(/<tr>/g)||[]).length,days);
  assert(!$('metrics').innerHTML.includes('NaN'));
  detail(data[0].date); assert($('detail-content').innerHTML.length>100);
 }
}
console.log('Passed: 3 patients × 3 periods; aggregation bounds, accepted-only chart points, daily rows, and detail rendering.');
`,context);
