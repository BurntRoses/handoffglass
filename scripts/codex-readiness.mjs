#!/usr/bin/env node
/** Metadata by default; --probe-host opts into a fresh no-model Codex app-server. */
import {checkCodexReadiness} from '../src/local/codex-readiness.mjs';
const args=process.argv.slice(2);
if(args.some(arg=>!['--json','--probe-host'].includes(arg)))throw Error('Usage: node scripts/codex-readiness.mjs [--json] [--probe-host]');
const result=await checkCodexReadiness({probeHost:args.includes('--probe-host')});
if(args.includes('--json'))console.log(JSON.stringify(result,null,2));
else{
  console.log('HandoffGlass · Codex 接入检查\n');
  const labels={installed:'安装',enabled:'启用',loaded:'工具加载',tool_approval:'绘制授权',first_call:'首次调用'};
  for(const [name,value]of Object.entries(result.stages))console.log(`${labels[name]}：${value.status} · ${value.code}`);
  console.log('\n'+result.nextAction.message);
  if(result.probeScope==='app_server_probe')console.log('此次检查使用独立探测会话，不代表当前 Codex 对话的加载状态。');
}
if(Object.values(result.stages).some(stage=>stage.status==='blocked'))process.exitCode=1;
