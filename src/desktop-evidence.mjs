/** Completeness checks for recorded physical desktop acceptance; never infers observations. */
import {redact} from './local/redact.mjs';
import {PREVIEW_TARGETS} from './release-contract.mjs';

export const DESKTOP_EVIDENCE_CHECKS=Object.freeze({
  windowsDesktop:Object.freeze(['launch','overlay','input_passthrough','handoff','restart_cleanup']),
  multiDisplay:Object.freeze(['cross_display','negative_coordinates','scale_change','hotplug'])
});
function object(value,name,keys,errors){
  if(!value||typeof value!=='object'||Array.isArray(value)){errors.push(`${name} must be an object`);return false;}
  for(const key of Object.keys(value))if(!keys.includes(key))errors.push(`${name}.${key} is not allowed in desktop evidence`);
  return true;
}
function text(value,name,errors,max=240){
  if(typeof value!=='string'||!value.trim()||value.length>max)errors.push(`${name} must be a bounded non-empty string`);
  else if(redact(value,max).redacted)errors.push(`${name} contains sensitive content; store only a redacted summary`);
}

export function validateDesktopEvidenceRecord(value,{kind}={}){
  const errors=[];
  if(!object(value,'record',['schemaVersion','kind','observedAt','build','platform','environment','displays','checks','limitations'],errors))return errors;
  if(value.schemaVersion!==1)errors.push('Unsupported desktop evidence schema');
  const required=Object.hasOwn(DESKTOP_EVIDENCE_CHECKS,value.kind)?DESKTOP_EVIDENCE_CHECKS[value.kind]:null;
  if(!required||(kind&&value.kind!==kind))errors.push('Desktop evidence kind does not match the release item');
  if(typeof value.observedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value.observedAt)||!Number.isFinite(Date.parse(value.observedAt)))errors.push('observedAt must be a UTC ISO timestamp');
  if(object(value.build,'build',['version','commit'],errors)){
    if(typeof value.build.version!=='string'||!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(value.build.version))errors.push('build.version must identify the tested release');
    if(typeof value.build.commit!=='string'||!/^([a-f0-9]{40}|[a-f0-9]{64})$/i.test(value.build.commit))errors.push('build.commit must be a full commit hash');
  }
  if(object(value.platform,'platform',['os','arch','version'],errors)){
    if(!PREVIEW_TARGETS.includes(`${value.platform.os}-${value.platform.arch}`))errors.push('platform must identify a supported desktop target');
    if(value.kind==='windowsDesktop'&&value.platform.os!=='win32')errors.push('Windows desktop evidence requires win32');
    text(value.platform.version,'platform.version',errors,120);
  }
  if(value.environment!=='physical-desktop')errors.push('Physical graphical desktop acceptance is required; headless or synthetic checks do not qualify');
  if(!Array.isArray(value.displays)||value.displays.length<1||value.displays.length>16)errors.push('displays must describe the physical display layout');
  else {
    const ids=new Set();
    for(const [index,display] of value.displays.entries()){
      const name=`displays[${index}]`;
      if(!object(display,name,['id','physical','primary','bounds','scaleFactor'],errors))continue;
      text(display.id,`${name}.id`,errors,80);
      if(ids.has(display.id))errors.push('Display IDs must be unique');
      ids.add(display.id);
      if(display.physical!==true)errors.push(`${name} must be a physical display`);
      if(typeof display.primary!=='boolean')errors.push(`${name}.primary must be explicit`);
      if(!Number.isFinite(display.scaleFactor)||display.scaleFactor<=0||display.scaleFactor>8)errors.push(`${name}.scaleFactor must be positive`);
      if(object(display.bounds,`${name}.bounds`,['x','y','width','height'],errors)){
        for(const key of ['x','y','width','height'])if(!Number.isFinite(display.bounds[key])||(['width','height'].includes(key)&&display.bounds[key]<=0))errors.push(`${name}.bounds.${key} must be a valid DIP measurement`);
      }
    }
    if(value.displays.filter(display=>display?.primary===true).length!==1)errors.push('Display layout must identify one primary display');
    if(value.kind==='multiDisplay'){
      if(value.displays.length<2)errors.push('Multi-display acceptance requires at least two physical displays');
      if(!value.displays.some(display=>display?.bounds?.x<0||display?.bounds?.y<0))errors.push('Multi-display acceptance must include a negative-coordinate layout');
    }
  }
  if(object(value.checks,'checks',required||[],errors))for(const check of required||[]){
    const item=value.checks[check],name=`checks.${check}`;
    if(!object(item,name,['result','observed'],errors))continue;
    if(item.result!=='passed')errors.push(`${name} must have an observed passed result`);
    text(item.observed,`${name}.observed`,errors);
  }
  if(value.limitations!==undefined){
    if(!Array.isArray(value.limitations)||value.limitations.length>8)errors.push('limitations must be a short list');
    else value.limitations.forEach((item,index)=>text(item,`limitations[${index}]`,errors));
  }
  return [...new Set(errors)];
}
