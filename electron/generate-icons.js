/**
 * Gera os ícones do app (PNG + ICO) a partir de public/favicon.svg,
 * usando a paleta de azul da aplicação (tema de bingo).
 *
 * Requisitos (instalados sob demanda no CI):
 *   npm install --no-save sharp png-to-ico
 *
 * Uso:
 *   node electron/generate-icons.js
 *
 * Saídas:
 *   build/icon.ico   -> usado pelo electron-builder (Windows) e janela
 *   build/icon.png   -> ícone 512x512 (fallback / outras plataformas)
 */
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const sharp = require('sharp');
  const pngToIco = require('png-to-ico');

  const root = path.join(__dirname, '..');
  const svgPath = path.join(root, 'public', 'favicon.svg');
  const outDir = path.join(root, 'build');

  fs.mkdirSync(outDir, { recursive: true });

  const svg = fs.readFileSync(svgPath);

  // PNG principal (512x512) para fallback e lojas.
  const png512 = path.join(outDir, 'icon.png');
  await sharp(svg, { density: 384 }).resize(512, 512).png().toFile(png512);

  // Conjunto de tamanhos para o .ico do Windows.
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = await Promise.all(
    sizes.map((size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer()),
  );

  const ico = await pngToIco(pngBuffers);
  fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);

  console.log('Ícones gerados em build/icon.ico e build/icon.png');
}

main().catch((err) => {
  console.error('Falha ao gerar ícones:', err);
  process.exitCode = 1;
});
