#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
if (process.platform !== 'darwin') {
  console.error('Mac native binary requires macOS and Xcode Command Line Tools'); process.exit(2);
}
for(const name of ['locate','capture']){
  const args=['-O',resolve(`native/macos/${name}.swift`),'-o',resolve(`native/macos/hg-${name}`)];
  const result=spawnSync('swiftc',args,{stdio:'inherit',timeout:120000});
  if(result.status!==0)process.exit(result.status??1);
}
