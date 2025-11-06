#!/usr/bin/env node
/**
 * SEA Build Script for climb
 * Creates single executable applications for multiple platforms
 * 
 * Usage:
 *   node scripts/build-sea.js              # Build all platforms (CI)
 *   node scripts/build-sea.js --current-only  # Build current platform only (dev)
 */

const { execSync } = require('child_process');
const { mkdirSync, copyFileSync, writeFileSync, existsSync, unlinkSync } = require('fs');
const { join } = require('path');
const { platform, arch } = require('os');

const PLATFORMS = [
  { os: 'linux', arch: 'x64', ext: '' },
  { os: 'darwin', arch: 'x64', ext: '' },      // Intel Mac
  { os: 'darwin', arch: 'arm64', ext: '' },     // M1/M2/M3 Mac
  { os: 'win32', arch: 'x64', ext: '.exe' }
];

const currentOnly = process.argv.includes('--current-only');
const targetPlatforms = currentOnly 
  ? [{ 
      os: platform(), 
      arch: arch() === 'arm64' ? 'arm64' : 'x64',
      ext: platform() === 'win32' ? '.exe' : '' 
    }]
  : PLATFORMS;

console.log('🧗 climb SEA Builder\n');
console.log(`Mode: ${currentOnly ? 'Current platform only' : 'All platforms'}`);
console.log(`Platform: ${platform()}-${arch()}\n`);

// Step 1: Bundle with esbuild
console.log('📦 Step 1/4: Bundling with esbuild...');
try {
  // Bundle EVERYTHING - no externals for SEA
  execSync(
    'npx esbuild src/index.ts --bundle --platform=node --format=cjs --outfile=dist/bundle.js --minify',
    { stdio: 'inherit' }
  );
  console.log('   ✅ Bundle created: dist/bundle.js\n');
} catch (error) {
  console.error('❌ esbuild failed:', error.message);
  process.exit(1);
}

// Step 2: Create SEA config
console.log('🔧 Step 2/4: Creating SEA configuration...');
const seaConfig = {
  main: 'dist/bundle.js',
  output: 'dist/sea-prep.blob',
  disableExperimentalSEAWarning: true,
  useCodeCache: true
};

writeFileSync('sea-config.json', JSON.stringify(seaConfig, null, 2));
console.log('   ✅ Configuration: sea-config.json\n');

// Step 3: Generate blob
console.log('🔮 Step 3/4: Generating SEA blob...');
try {
  execSync('node --experimental-sea-config sea-config.json', { stdio: 'inherit' });
  console.log('   ✅ Blob created: dist/sea-prep.blob\n');
} catch (error) {
  console.error('❌ SEA blob generation failed:', error.message);
  process.exit(1);
}

// Step 4: Build for each platform
console.log('🏗️  Step 4/4: Building executables...\n');
mkdirSync('dist/binaries', { recursive: true });

let builtCount = 0;
let skippedCount = 0;

for (const { os, arch: targetArch, ext } of targetPlatforms) {
  const name = `climb-${os}-${targetArch}${ext}`;
  console.log(`  Building ${name}...`);
  
  // Only build current platform for local builds
  const isCurrentPlatform = os === platform() && 
    (targetArch === 'x64' ? arch() === 'x64' || arch() === 'x86_64' : arch() === targetArch);
  
  if (currentOnly && !isCurrentPlatform) {
    console.log(`    ⏭️  Skipping (requires ${os}-${targetArch} environment)\n`);
    skippedCount++;
    continue;
  }
  
  if (!currentOnly && !isCurrentPlatform) {
    console.log(`    ⏭️  Skipping (will be built in GitHub Actions ${os}-${targetArch})\n`);
    skippedCount++;
    continue;
  }
  
  try {
    buildForPlatform(os, targetArch, ext, name);
    builtCount++;
  } catch (error) {
    console.error(`    ❌ Failed: ${error.message}\n`);
    if (!currentOnly) {
      process.exit(1);
    }
  }
}

// Cleanup
if (existsSync('sea-config.json')) {
  unlinkSync('sea-config.json');
}

console.log('━'.repeat(50));
console.log(`✅ Build complete! Built: ${builtCount}, Skipped: ${skippedCount}\n`);
console.log('📁 Binaries location: dist/binaries/');
console.log('💡 Test with: ./dist/binaries/climb-' + platform() + '-' + (arch() === 'arm64' ? 'arm64' : 'x64') + (platform() === 'win32' ? '.exe' : ''));
console.log('━'.repeat(50));

/**
 * Build SEA binary for a specific platform
 */
function buildForPlatform(os, arch, ext, name) {
  const nodePath = process.execPath; // Current node binary
  const outputPath = join('dist', 'binaries', name);
  
  // Step 1: Copy node binary
  copyFileSync(nodePath, outputPath);
  
  // Step 2: macOS specific - remove signature
  if (os === 'darwin') {
    try {
      execSync(`codesign --remove-signature "${outputPath}"`, { stdio: 'pipe' });
    } catch (error) {
      // Ignore error if binary is not signed
    }
  }
  
  // Step 3: Inject SEA blob using postject
  const postjectCmd = os === 'darwin'
    ? `npx postject "${outputPath}" NODE_SEA_BLOB dist/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --macho-segment-name NODE_SEA`
    : `npx postject "${outputPath}" NODE_SEA_BLOB dist/sea-prep.blob --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`;
  
  execSync(postjectCmd, { stdio: 'pipe' });
  
  // Step 4: macOS specific - re-sign binary
  if (os === 'darwin') {
    execSync(`codesign --sign - "${outputPath}"`, { stdio: 'pipe' });
  }
  
  // Get file size
  const { size } = require('fs').statSync(outputPath);
  const sizeMB = (size / (1024 * 1024)).toFixed(1);
  
  console.log(`    ✅ ${name} (${sizeMB} MB)\n`);
}
