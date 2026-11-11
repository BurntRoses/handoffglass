import {join} from 'node:path';
import {access} from 'node:fs/promises';
import {readApplicationInstallation,fileDigest} from '../application-installation.mjs';

/** Prefer the recorded final app; source Electron is a development fallback. */
export async function installedDesktop(env=process.env) {
  if(env.HANDOFFGLASS_ELECTRON)return {executable:env.HANDOFFGLASS_ELECTRON};
  try {
    const {record}=await readApplicationInstallation({...(env.HANDOFFGLASS_RUNTIME_DIR?{dir:env.HANDOFFGLASS_RUNTIME_DIR}:{})});
    const app=record?.application;if(!app||await fileDigest(app.identityPath)!==app.identityDigest)return null;
    const executable=process.platform==='darwin'?join(app.path,'Contents','MacOS','HandoffGlass'):join(app.path,'HandoffGlass.exe');
    await access(executable);
    return {executable,packaged:true,nativeResourceDir:process.platform==='darwin'?join(app.path,'Contents','Resources','native'):join(app.path,'resources','native')};
  }catch{return null;}
}
