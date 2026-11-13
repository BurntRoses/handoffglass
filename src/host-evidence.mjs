/** Validate privacy-preserving evidence for one real host task. */
import { redact } from './local/redact.mjs';
import { HARNESS_ORDER } from './hosts/adapter.mjs';

export const HOST_EVIDENCE_SCHEMA = 1;
export const REQUIRED_HOST_STAGES = Object.freeze(['guidance','human_decision','independent_verification','resume']);
const STATUS = new Set(['verified','unverified']);
const DECISIONS = new Set(['completed','declined','cancelled']);
const VERIFICATIONS = new Set(['verified','mismatch','inconclusive']);
const RECORD_KEYS = new Set(['schemaVersion','host','platform','hostVersion','handoffglassVersion','task','stages','result','limitations']);
const STAGE_KEYS = new Set(['status','evidence','decision','result','nextAction']);
const FORBIDDEN_KEY = /token|secret|password|credential|screenshot|account|window.?title|transcript|consent|file.?content|otp|验证码|密码/i;

function bounded(value,name,max=240){
  if(typeof value!=='string'||!value.trim()||value.length>max)return `${name} must be a bounded non-empty string`;
  const safe=redact(value,max);
  if(safe.redacted)return `${name} contains sensitive material; store only its redacted summary`;
  return null;
}
function walkKeys(value,path,errors){
  if(!value||typeof value!=='object')return;
  if(Array.isArray(value)){value.forEach((item,index)=>walkKeys(item,`${path}[${index}]`,errors));return;}
  for(const [key,item] of Object.entries(value)){
    if(FORBIDDEN_KEY.test(key))errors.push(`${path}.${key} is not allowed in host evidence`);
    walkKeys(item,`${path}.${key}`,errors);
  }
}
function object(value,name,errors){
  if(!value||typeof value!=='object'||Array.isArray(value))errors.push(`${name} must be an object`);
  return value&&typeof value==='object'&&!Array.isArray(value);
}

export function validateHostEvidenceRecord(value,{host}={}){
  const errors=[];
  if(!object(value,'Host evidence',errors))return errors;
  walkKeys(value,'record',errors);
  if(value.schemaVersion!==HOST_EVIDENCE_SCHEMA)errors.push('Unsupported host evidence schema');
  if(!HARNESS_ORDER.includes(value.host)||(host&&value.host!==host))errors.push('Host evidence host does not match the advertised host');
  for(const key of ['platform','hostVersion','handoffglassVersion']){const error=bounded(value[key],key,120);if(error)errors.push(error);}
  if(!object(value.task,'task',errors))return errors;
  if(typeof value.task.kind!=='string'||!value.task.kind.trim()||value.task.kind.length>80)errors.push('task.kind must be bounded');
  const taskError=bounded(value.task.summary,'task.summary');if(taskError)errors.push(taskError);
  if(!['low','medium','high','irreversible'].includes(value.task.risk))errors.push('task.risk is invalid');
  if(!object(value.stages,'stages',errors))return errors;
  for(const stage of REQUIRED_HOST_STAGES){
    const item=value.stages[stage];
    if(!object(item,`stages.${stage}`,errors))continue;
    for(const key of Object.keys(item))if(!STAGE_KEYS.has(key))errors.push(`stages.${stage}.${key} is not allowed in host evidence`);
    if(item.status!=='verified')errors.push(`Host evidence stage is not verified: ${stage}`);
    const evidenceError=bounded(item.evidence,`stages.${stage}.evidence`);if(evidenceError)errors.push(evidenceError);
  }
  if(!DECISIONS.has(value.stages.human_decision?.decision))errors.push('Human decision must be explicit');
  const result=value.stages.independent_verification?.result;
  if(!VERIFICATIONS.has(result))errors.push('Independent verification result is invalid');
  if(result&&result!=='verified')errors.push(`Inconclusive or mismatched verification is ${result}; it cannot establish a verified host record`);
  if(value.stages.resume?.nextAction!==undefined){const error=bounded(value.stages.resume.nextAction,'stages.resume.nextAction');if(error)errors.push(error);}
  if(value.result!=='completed')errors.push('A verified host record must have a completed result');
  if(value.limitations!==undefined){
    if(!Array.isArray(value.limitations)||value.limitations.length>8)errors.push('limitations must be a short list');
    else value.limitations.forEach((item,index)=>{const error=bounded(item,`limitations[${index}]`);if(error)errors.push(error);});
  }
  for(const key of Object.keys(value))if(!RECORD_KEYS.has(key))errors.push(`record.${key} is not allowed in host evidence`);
  return [...new Set(errors)];
}

export function validateHostEvidenceMatrix(value){
  const errors=[];
  if(!object(value,'Host evidence matrix',errors))return errors;
  if(value.schemaVersion!==HOST_EVIDENCE_SCHEMA)errors.push('Unsupported host evidence matrix schema');
  if(JSON.stringify(value.requiredStages)!==JSON.stringify(REQUIRED_HOST_STAGES))errors.push('Host evidence required stages changed');
  if(!object(value.hosts,'hosts',errors))return errors;
  const supported=new Set(HARNESS_ORDER);
  for(const host of Object.keys(value.hosts))if(!supported.has(host))errors.push(`Unsupported host in evidence matrix: ${host}`);
  for(const host of HARNESS_ORDER){
    const item=value.hosts[host];
    if(!object(item,`hosts.${host}`,errors))continue;
    if(!STATUS.has(item.status))errors.push(`Invalid host status: ${host}`);
    if(item.status==='verified'&&typeof item.record!=='string')errors.push(`Verified host needs a record: ${host}`);
  }
  return [...new Set(errors)];
}

export function assertHostEvidenceRecord(value,options={}){const errors=validateHostEvidenceRecord(value,options);if(errors.length)throw new TypeError(errors.join('\n'));return true;}
export function assertHostEvidenceMatrix(value){const errors=validateHostEvidenceMatrix(value);if(errors.length)throw new TypeError(errors.join('\n'));return true;}
