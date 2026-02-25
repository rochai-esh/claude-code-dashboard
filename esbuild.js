const esbuild = require('esbuild')

const isProduction = process.argv.includes('--production')
const isWatch = process.argv.includes('--watch')

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: isProduction,
    sourcemap: !isProduction,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'silent',
    plugins: [
      {
        name: 'watch-log',
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length) {
              console.error('Build failed:', result.errors)
            } else {
              console.log('[esbuild] build finished')
            }
          })
        },
      },
    ],
  })

  if (isWatch) {
    await ctx.watch()
    console.log('[esbuild] watching for changes...')
  } else {
    await ctx.rebuild()
    await ctx.dispose()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
