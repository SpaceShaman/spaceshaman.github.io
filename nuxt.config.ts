// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	srcDir: 'src',
	compatibilityDate: '2024-11-01',
	devtools: { enabled: true },
	modules: [
		'@nuxtjs/tailwindcss',
		'@nuxt/eslint',
		'@nuxtjs/mdc',
		'@nuxt/icon',
		'@nuxtjs/color-mode',
	],
	colorMode: {
		preference: 'system',
		fallback: 'dark',
		dataValue: 'theme',
	},
	components: [
		{
			path: '~/components',
		},
		{
			path: '~/components/ui',
			pathPrefix: false,
		},
	],
})
