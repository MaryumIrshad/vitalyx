(function(root){
  const STORAGE_KEY='vitalyx-care-team-alerts-v1';
  function createCareAlertStore(storage,clock=()=>new Date()){
    const read=()=>{
      try{const value=JSON.parse(storage.getItem(STORAGE_KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
      catch{return {}}
    };
    const write=records=>{try{storage.setItem(STORAGE_KEY,JSON.stringify(records));return true}catch{return false}};
    return {
      get(patientId){return read()[patientId]||null},
      request({patientId,patientName,reason,recipient='Care Team / Triage Nurse'}){
        if(!patientId)throw new Error('A patient ID is required to create a review request.');
        const records=read(),existing=records[patientId];
        if(existing)return {alert:existing,created:false,saved:true};
        const alert={patientId,patientName,reason:Array.isArray(reason)?reason:[String(reason||'')],recipient,status:'pending',createdAt:clock().toISOString()};
        records[patientId]=alert;return {alert,created:true,saved:write(records)};
      },
      acknowledge(patientId){
        const records=read(),alert=records[patientId];
        if(!alert||alert.status!=='pending')return {alert:alert||null,changed:false,saved:true};
        alert.status='acknowledged';alert.acknowledgedAt=clock().toISOString();records[patientId]=alert;
        return {alert,changed:true,saved:write(records)};
      }
    };
  }
  root.VitalyxCareAlerts=createCareAlertStore(root.localStorage);
  if(typeof module!=='undefined'&&module.exports)module.exports={createCareAlertStore,STORAGE_KEY};
})(typeof window!=='undefined'?window:globalThis);
