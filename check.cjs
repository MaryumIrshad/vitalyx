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
  assert.equal(($('clinical-insights').innerHTML.match(/class="clinical-insight"/g)||[]).length,3);
  assert($('clinical-insights').innerHTML.includes('Selected period'));
  detail(data[0].date); assert($('detail-content').innerHTML.length>100);
 }
}
for (const specialty of ['Pulmonology','Primary care','Nursing']) {
 $('specialty').value=specialty; period=7; render();
 assert($('specialty-lens').innerHTML.includes(specialty+' lens'));
  const expected=specialty==='Primary care'?'Daily symptoms & school impact':specialty==='Nursing'?'Controller doses marked taken by day':'Lung function over time';
  assert.equal($('focus-chart-title').textContent,expected);
  assert.equal(($('clinical-insights').innerHTML.match(/class="clinical-insight"/g)||[]).length,3);
  assert($('clinical-insights').innerHTML.includes('Symptoms and school impact'));
  assert($('clinical-insights').innerHTML.includes('Accepted lung-function readings'));
  assert($('clinical-insights').innerHTML.includes('Separate reporting streams'));
}
console.log('Passed: 3 patients x 3 date ranges; multiple FEV1 readings, quality selection, daily best trends, specialty lenses, shared clinical insights, daily rows, and detail rendering.');
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

const recentSignals=vm.runInContext('recentReviewSignals',context);
const comparePriority=vm.runInContext('comparePatientPriority',context);
const reviewFixture=Array.from({length:14},(_,i)=>{
 const trackerSubmitted=i<4||i>=7&&i<11;
 const symptoms=(i===0||i===7||i===8)?['Coughing']:[];
 const readingValues=i<3?[2.8,2.9,3.0][i]:i>=7&&i<10?[2.5,2.4,2.6][i-7]:null;
 return {date:`2026-06-${String(i+1).padStart(2,'0')}`,trackerSubmitted,missing:!trackerSubmitted,submissions:trackerSubmitted?1:0,symptoms,school:trackerSubmitted?0:null,feeling:trackerSubmitted?'Okay':null,zone:trackerSubmitted?'green':'unknown',medicationReported:i<6||i>=7&&i<12,doses:i<6||i>=7&&i<12?2:null,rescue:i<6||i>=7&&i<12?0:null,readings:readingValues===null?[]:[{fev:readingValues,quality:'accepted'}]};
});
context.auditFixture=reviewFixture;
vm.runInContext('dataset=()=>auditFixture',context);
const cues=recentSignals('alex');
assert.equal(cues.trackerDays,4);
assert.equal(cues.medicationReportDays,5);
assert.equal(cues.deviceReadingDays,3);
assert(cues.signals.some(x=>x.kind==='symptom'&&x.text.includes('2/4 vs 1/4')&&x.text.includes('+25 percentage points')));
assert(cues.signals.some(x=>x.kind==='fev1'&&x.text.includes('2.50 vs 2.90 L')&&x.text.includes('3 vs 3 days')));
assert(cues.signals.some(x=>x.kind==='gap'&&x.text==='No tracker submission on the last 3 days'));
context.auditFixture=reviewFixture.map((day,i)=>i>=7?{...day,readings:[{fev:1.5,quality:'rejected'},{fev:1.6,quality:'conflicting'}]}:day);
assert(!recentSignals('alex').signals.some(x=>x.kind==='fev1'),'Rejected/conflicting blows must not create an accepted FEV1 trend cue');
assert(comparePriority({signals:[1],symptomRatePercent:.5,p:{name:'A'}},{signals:[],symptomRatePercent:1,p:{name:'B'}})<0);
assert(comparePriority({signals:[],symptomRatePercent:.5,p:{name:'A'}},{signals:[],symptomRatePercent:.25,p:{name:'B'}})<0);
assert(comparePriority({signals:[],symptomRatePercent:null,p:{name:'A'}},{signals:[],symptomRatePercent:0,p:{name:'B'}})>0);
const noComparableFixture=Array.from({length:14},(_,i)=>({date:`2026-06-${String(i+1).padStart(2,'0')}`,trackerSubmitted:i>=7,missing:i<7,submissions:i>=7?1:0,symptoms:[],school:i>=7?0:null,feeling:i>=7?'Great':null,zone:i>=7?'green':'unknown',medicationReported:false,doses:null,rescue:null,readings:[]}));
context.auditFixture=noComparableFixture;
const noComparisons=recentSignals('alex');
assert.equal(noComparisons.signals.length,0);
assert.equal(noComparisons.trackerDays,7);
assert.equal(noComparisons.deviceReadingDays,0);
vm.runInContext('renderPatientDirectory()',context);
assert(element('patient-roster-list').innerHTML.includes('No comparison cue'));
assert(element('patient-roster-list').innerHTML.includes('check recent stream coverage'));
assert(element('patient-roster-list').innerHTML.includes('device 0/7'));
console.log('Passed: directory cues use paired 7-day denominators, accepted daily-best medians with sample counts, consecutive tracker gaps, stream coverage, and cue-count/frequency sorting.');
