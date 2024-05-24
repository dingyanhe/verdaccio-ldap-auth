import { defineConfig } from 'rollup'
import resolver from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'
import json from '@rollup/plugin-json'

const isProduction = process.env.NODE_ENV === 'production';

export default defineConfig([{
	input: 'src/index.ts',
	output: {
		file: 'dist/bundle.js',
		format: 'cjs',
		sourcemap: true,
	},
	plugins: [
		resolver(),

		json(),
		commonjs(),
		typescript({
			tsconfig: './tsconfig.json',
		}),
		
		isProduction && (await import('@rollup/plugin-terser')).default()
	]
}, {
	input: 'src/index.ts',
	output: {
		file: 'dist/bundle.esm.js',
		format: 'esm',
		sourcemap: true,
	},
	plugins: [
		resolver(),

		json(),
		commonjs(),
		typescript({
			tsconfig: './tsconfig.json',
		}),
		
		isProduction && (await import('@rollup/plugin-terser')).default()
	]
}])
