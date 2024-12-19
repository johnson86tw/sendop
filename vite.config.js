import { defineConfig } from 'vite'
import path from 'path'
import dts from 'vite-plugin-dts'
import pkg from './package.json'

const libName = pkg.name

export default defineConfig({
	resolve: {
		alias: { '@': path.resolve(__dirname, 'src') },
	},
	plugins: [
		dts({
			tsconfigPath: './tsconfig.json',
			insertTypesEntry: true,
			rollupTypes: false,
			include: ['src/**/*.ts'],
		}),
	],
	build: {
		sourcemap: true,
		lib: {
			entry: path.resolve(__dirname, 'src/index.ts'),
			name: libName,
			formats: ['es', 'umd'],
			fileName: 'index',
		},
		outDir: 'dist',
	},
})

// Vite Library Mode https://vitejs.dev/guide/build.html#library-mode
// https://github.com/qmhc/vite-plugin-dts
