<template>
	<ActionButton
		:icon="
			$colorMode.preference === 'light'
				? 'mdi:weather-night'
				: 'mdi:weather-sunny'
		"
		@click="
			$colorMode.preference =
				$colorMode.preference === 'light' ? 'dark' : 'light'
		"
	/>
</template>
