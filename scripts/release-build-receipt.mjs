/** Called only after electron-builder has emitted this build's artifacts. */
import { basename, dirname, join, resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { packagedRuntime, hashFile, releaseTarget, validateDownloadNames } from '../src/release-contract.mjs';
export async function recordBuiltArtifacts({outDir, artifactPaths}) {
  const paths = artifactPaths.filter(path => /\.(zip|exe)$/i.test(path));
  if (!paths.length) return []; // --dir has no downloadable artifacts.
  if (paths.some(path => resolve(dirname(path)) !== resolve(outDir))) throw new Error('Unexpected artifact location');
  const {handoffglassBuild:build} = (await import('../electron-builder.config.cjs')).default.extraMetadata;
  const buildVersion = build.version;
  validateDownloadNames(paths.map(path => basename(path)), {version:buildVersion});
  const runtime = await packagedRuntime(outDir);
  const artifacts = [];
  for (const path of paths) artifacts.push({name:basename(path),sha256:await hashFile(path)});
  const receipt = {schemaVersion:1,target:releaseTarget(),version:buildVersion,build,
    asarSha256:await hashFile(join(runtime.resources,'app.asar')),artifacts};
  await writeFile(join(outDir,'build-artifacts.json'),JSON.stringify(receipt,null,2)+'\n');
  return [];
}
