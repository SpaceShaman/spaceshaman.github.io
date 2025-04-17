<template>
	<button
		class="btn btn-soft btn-circle"
		@click="
			$colorMode.preference =
				$colorMode.preference === 'light' ? 'dark' : 'light'
		"
	>
		<Icon
			:name="
				$colorMode.preference === 'light'
					? 'mdi:weather-night'
					: 'mdi:weather-sunny'
			"
			size="1.5rem"
		/>
	</button>
</template>
