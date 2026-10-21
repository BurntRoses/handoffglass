/** Release assertions shared by CI and local builds. No host configuration access. */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export const PREVIEW_TARGETS = Object.freeze(['darwin-arm64', 'darwin-x64', 'win32-x64']);
export function releaseTarget(platform = process.platform, arch = process.arch) {
  const target = `${platform}-${arch}`;
  if (!PREVIEW_TARGETS.includes(target)) throw new Error(`Desktop release target is not validated: ${target}`);
  return target;
}
export function expectedDownloads(version, platform = process.platform, arch = process.arch) {
  releaseTarget(platform, arch);
  if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) throw new Error('Invalid release version');
  return platform === 'darwin' ? [`HandoffGlass-${version}-mac-${arch}.zip`] :
    ['setup', 'portable'].map(kind => `HandoffGlass-${version}-windows-${arch}-${kind}.exe`);
}
export function validateDownloadNames(names, options) {
  const expected = expectedDownloads(options.version, options.platform, options.arch);
  const actual = names.filter(name => /\.(zip|exe|AppImage|dmg|msi)$/i.test(name)).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort()))
    throw new Error(`Expected only ${expected.join(', ')}; found ${actual.join(', ') || 'no downloads'}. Use an empty build output directory.`);
  return expected;
}
export async function hashFile(path) {
  if (!(await lstat(path)).isFile()) throw new Error('Release input must be a regular file');
  const hash = createHash('sha256');
  for await (const data of createReadStream(path)) hash.update(data);
  return hash.digest('hex');
}
export async function packagedRuntime(dist, { platform = process.platform, arch = process.arch } = {}) {
  releaseTarget(platform, arch);
  let candidates;
  if (platform === 'darwin') {
    const names = arch === 'arm64' ? ['mac-arm64'] : ['mac', 'mac-x64'];
    candidates = names.map(name => {
      const contents = join(dist, name, 'HandoffGlass.app', 'Contents');
      return { binary: join(contents, 'MacOS', 'HandoffGlass'), resources: join(contents, 'Resources') };
    });
  } else candidates = [{ binary: join(dist, 'win-unpacked', 'HandoffGlass.exe'), resources: join(dist, 'win-unpacked', 'resources') }];
  const found = [];
  for (const item of candidates) {
    try {
      if (!(await lstat(item.binary)).isFile()) continue;
      if (!(await lstat(join(item.resources, 'app.asar'))).isFile()) continue;
      found.push({ ...item, entry: join(item.resources, 'app.asar', 'src', 'mcp.mjs') });
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (found.length !== 1) throw new Error(`Expected one packaged ${platform}-${arch} runtime; found ${found.length}`);
  return found[0];
}
export function assessPublicRelease({ license, licenseText = '', evidence = {} }) {
  const blockers = [];
  if (!license || license === 'UNLICENSED' || !licenseText.trim()) blockers.push('distribution_license');
  // Each item needs recorded acceptance, rather than inference from a successful build.
  for (const id of ['macosSigning', 'windowsSigning', 'windowsDesktop', 'multiDisplay', 'codexHost', 'workbuddyHost']) {
    const item = evidence[id];
    if (item?.status !== 'verified' || !item.record) blockers.push(id);
  }
  return { publicReady: blockers.length === 0, blockers };
}
export async function assertStageContents(dir, names) {
  let entries;
  try {
    if (!(await lstat(dir)).isDirectory()) throw new Error('Release staging must be a real directory');
    entries = await readdir(dir, { withFileTypes: true });
  }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  for (const entry of entries) {
    if (!entry.isFile() || !names.includes(entry.name)) throw new Error('Release staging contains unrelated or older files; choose an empty staging directory');
  }
}
