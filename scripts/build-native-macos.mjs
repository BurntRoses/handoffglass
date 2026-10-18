#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
if (process.platform !== 'darwin') {
  console.error('Mac native binary requires macOS and Xcode Command Line Tools'); process.exit(2);
}
const args=['-O', resolve('native/macos/locate.swift'), '-o', resolve('native/macos/hg-locate')];
const result=spawnSync('swiftc',args,{stdio:'inherit',timeout:120000});
process.exit(result.status ?? 1);
