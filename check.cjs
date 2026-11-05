const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {innerHTML:'',textContent:'',value:id==='specialty'?'Pulmonology':'',style:{},classList:{toggle(){}},addEventListener(){},querySelectorAll(){return[]},querySelector(){return element('child')},getAttribute(){return'false'},setAttribute(){},showModal(){},close(){}});
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
  assert(data.every(d=>d.medicationReported ? d.doses>=0 && d.doses<=2 : d.doses===null));
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
  assert($('metrics').innerHTML.includes('Latest daily best accepted FEV1'));
  assert($('clinical-insights').innerHTML.includes('What changed')===false || $('clinical-insights').innerHTML.length>100);
  detail(data[0].date); assert($('detail-content').innerHTML.length>100);
 }
}
for (const specialty of ['Pulmonology','Primary care','Nursing']) {
 $('specialty').value=specialty; period=7; render();
 assert($('specialty-lens').innerHTML.includes(specialty+' lens'));
  const expected=specialty==='Primary care'?'Daily symptoms & school impact':specialty==='Nursing'?'Controller doses marked taken by day':'Lung function over time';
  assert.equal($('focus-chart-title').textContent,expected);
}
console.log('Passed: 3 patients x 3 date ranges; multiple FEV1 readings, quality selection, daily best trends, daily rows, and detail rendering.');
`,context);
const stats=vm.runInContext('oneMinuteStats',context);
const insights=vm.runInContext('buildClinicalInsights',context);
const patient={personalBest:3};
const streamFixture=[{date:'2026-06-01',trackerSubmitted:false,missing:true,symptoms:[],school:null,medicationReported:true,doses:1,rescue:0,readings:[{fev:2.5,quality:'accepted'}]}];
const streamStats=stats(streamFixture,3);
assert.equal(streamStats.trackerDays,0);
assert.equal(streamStats.medicationReportDays,1);
assert.equal(streamStats.controllerRatePercent,50);
assert.equal(streamStats.deviceReadingDays,1);
assert.equal(streamStats.symptomRatePercent,null);
const noMedReport=[{...streamFixture[0],medicationReported:false,doses:null}];
assert.equal(stats(noMedReport,3).controllerSlots,0);
assert.equal(stats(noMedReport,3).controllerRatePercent,null);
const fevFixture=[
 {date:'2026-06-01',trackerSubmitted:true,missing:false,symptoms:[],school:0,medicationReported:false,doses:null,rescue:null,readings:[{fev:2.6,quality:'accepted'},{fev:3.9,quality:'rejected'},{fev:4.1,quality:'conflicting'}]},
 {date:'2026-06-02',trackerSubmitted:true,missing:false,symptoms:['Coughing'],school:1,medicationReported:false,doses:null,rescue:null,readings:[{fev:2.8,quality:'accepted'}]}
];
const fevStats=stats(fevFixture,3);
assert.equal(fevStats.acceptedAttempts,2);
assert.equal(fevStats.excludedAttempts,2);
assert.equal(fevStats.latestDailyBest.best.fev,2.8);
assert.equal(fevStats.medianDailyBestLiters,2.7);
assert.notEqual(fevStats.latestDailyBest.best.fev,fevStats.medianDailyBestLiters);
const noPrior=insights(fevFixture,null,patient,2,'Pulmonology');
assert(noPrior.every(x=>x.summary.includes('No previous equivalent period')||x.kind==='fev'));
assert(noPrior.every(x=>x.records.some(r=>r.period==='Selected'&&r.day.date==='2026-06-01')));
const withPrior=insights(fevFixture,[{...fevFixture[0],date:'2026-05-30',symptoms:[],readings:[{fev:2.4,quality:'accepted'}]},{...fevFixture[1],date:'2026-05-31',symptoms:[],school:0,readings:[{fev:2.5,quality:'accepted'}]}],patient,2,'Pulmonology');
assert(withPrior.find(x=>x.kind==='fev').summary.includes('0.3 L vs previous 2 days'));
assert(withPrior.find(x=>x.kind==='symptoms').summary.includes('percentage points vs previous 2 days'));
assert(withPrior.find(x=>x.kind==='reporting').context.includes('patient-reported, not verified administration'));
assert.equal(stats([{...noMedReport[0],readings:[{fev:4,quality:'rejected'}]}],3).latestDailyBest,null);
console.log('Passed: stream-specific missingness, denominator handling, accepted-only FEV1 median/latest, no-prior comparisons, percentage-point reporting, and traceable evidence records.');
