import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
	test: {
		setupFiles: ['dotenv/config'],
		include: ['src/**/*.test.ts'],
		testTimeout: 100000,
	},
	resolve: {
		alias: { '@': path.resolve(__dirname, 'src') },
	},
})
