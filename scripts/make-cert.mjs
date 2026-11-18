// 生成本地开发用的自签 HTTPS 证书。
//
// 为什么需要：手机同网段调试时，getUserMedia（应用内相机）、
// navigator.share（存相册）、Service Worker（PWA 安装）都要求安全上下文。
// http://局域网IP 不算安全上下文，只有 https 或 localhost 才算。
//
// 这个脚本会把本机所有局域网 IPv4 都写进证书的 SAN，
// 所以手机直接访问 https://<你的IP>:端口 就行（需手动信任一次证书）。

import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'certs');
const certPath = join(outDir, 'dev-cert.pem');
const keyPath = join(outDir, 'dev-key.pem');
const confPath = join(outDir, 'dev-cert.cnf');

const lanIps = Object.values(networkInterfaces())
  .flat()
  .filter((item) => item && item.family === 'IPv4' && !item.internal)
  .map((item) => item.address);

const altNames = [
  'DNS.1 = localhost',
  'DNS.2 = *.local',
  'IP.1 = 127.0.0.1',
  ...lanIps.map((ip, index) => `IP.${index + 2} = ${ip}`)
];

const conf = `[req]
distinguished_name = dn
x509_extensions = v3_req
prompt = no

[dn]
CN = zhirikede-dev

[v3_req]
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt

[alt]
${altNames.join('\n')}
`;

const force = process.argv.includes('--force');
if (existsSync(certPath) && existsSync(keyPath) && !force) {
  console.log(`证书已存在：${certPath}`);
  console.log('想换 IP 或重新生成，加 --force');
} else {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(confPath, conf);
  try {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '30',
      '-keyout', keyPath, '-out', certPath, '-config', confPath
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    console.log('证书已生成：');
    console.log(`  ${certPath}`);
    console.log(`  ${keyPath}`);
  } catch (err) {
    console.error('生成证书失败，确认本机有 openssl');
    console.error(err?.stderr?.toString() || err?.message || err);
    process.exit(1);
  }
}

console.log('\n可用的局域网地址：');
if (lanIps.length) {
  for (const ip of lanIps) console.log(`  https://${ip}:5175/`);
} else {
  console.log('  （没找到局域网 IP，先连上 Wi-Fi 或热点再跑一次）');
}
console.log('\n手机第一次打开会提示证书不受信任：');
console.log('  iOS  → 继续访问 → 设置 → 通用 → 关于本机 → 证书信任设置 → 打开开关');
console.log('  Android → 高级 → 继续前往（Chrome 会记 7 天）');
