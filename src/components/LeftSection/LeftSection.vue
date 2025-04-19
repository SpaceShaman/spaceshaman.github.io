<template>
	<Card class="text-center">
		<div class="avatar justify-center">
			<div class="w-52 rounded-full border-4 border-accent object-cover">
				<img src="assets/avatar-0.jpg" />
			</div>
		</div>
		<h1>Krzysztof Stanisławski</h1>
		<h2>Fullstack Developer</h2>
		<div class="mb-4">
			I'm a fullstack developer with a passion for creating advanced web
			applications.
		</div>
		<LeftSectionSkills />
		<div class="mt-4 flex justify-center gap-4 text-accent">
			<a href="https://github.com/SpaceShaman" target="_blank">
				<Icon name="mdi:github" size="2rem" />
			</a>
			<a
				href="https://www.linkedin.com/in/krzysztof-stanislawski/"
				target="_blank"
			>
				<Icon name="mdi:linkedin" size="2rem" />
			</a>
		</div>
		<div class="justify-center">
			<h2 class="mt-2">
				<a href="mailto:stanislawski@tuta.io" target="_blank">
					stanislawski@tuta.io
				</a>
			</h2>
			<h2 class="mt-2">
				<a href="tel:+48790228481" target="_blank">+48 790 228 481</a>
			</h2>
		</div>
	</Card>
</template>
