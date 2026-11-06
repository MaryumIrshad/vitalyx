const test=require('node:test');
const assert=require('node:assert/strict');
const {createCareAlertStore,STORAGE_KEY}=require('./dist/care-alerts.js');

function memoryStorage(initial=null){
  const values=new Map(initial===null?[]:[[STORAGE_KEY,initial]]);
  return {getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),values};
}

test('creates one pending alert from the supplied patient cues and persists it',()=>{
  const storage=memoryStorage(),time=new Date('2026-11-06T17:00:00.000Z'),store=createCareAlertStore(storage,()=>time);
  const result=store.request({patientId:'VY-104',patientName:'Fictional Patient',reason:['Symptoms increased by 20 pp','Accepted FEV1 decreased by 0.08 L']});
  assert.equal(result.created,true);assert.equal(result.saved,true);assert.equal(result.alert.status,'pending');
  assert.deepEqual(result.alert.reason,['Symptoms increased by 20 pp','Accepted FEV1 decreased by 0.08 L']);
  assert.equal(result.alert.recipient,'Care Team / Triage Nurse');
  assert.equal(store.get('VY-104').createdAt,time.toISOString());
});

test('does not create a duplicate pending request for the same patient',()=>{
  const storage=memoryStorage(),store=createCareAlertStore(storage);
  const first=store.request({patientId:'VY-104',patientName:'Fictional Patient',reason:['Symptoms increased']});
  const duplicate=store.request({patientId:'VY-104',patientName:'Fictional Patient',reason:['Different reason']});
  assert.equal(duplicate.created,false);assert.equal(duplicate.alert.createdAt,first.alert.createdAt);
  assert.equal(Object.keys(JSON.parse(storage.getItem(STORAGE_KEY))).length,1);
});

test('acknowledgement persists across a newly initialized store (page refresh)',()=>{
  const storage=memoryStorage(),store=createCareAlertStore(storage);
  store.request({patientId:'VY-104',patientName:'Fictional Patient',reason:['Symptoms increased']});
  const result=store.acknowledge('VY-104');
  assert.equal(result.changed,true);assert.equal(result.alert.status,'acknowledged');
  const afterRefresh=createCareAlertStore(storage);
  assert.equal(afterRefresh.get('VY-104').status,'acknowledged');
  assert.equal(afterRefresh.acknowledge('VY-104').changed,false);
});

test('handles malformed stored data and rejects missing patient IDs safely',()=>{
  const store=createCareAlertStore(memoryStorage('{broken json'));
  assert.equal(store.get('VY-104'),null);
  assert.throws(()=>store.request({patientName:'Fictional Patient',reason:[]}),/patient ID is required/);
});
