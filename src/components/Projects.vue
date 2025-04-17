<script setup lang="ts">
	import projects from '../public/projects.json'
</script>
<template>
	<div v-for="(project, index) in projects" :key="index">
		<h2>
			<a :href="project.url" target="_blank">
				{{ project.name }}
			</a>
		</h2>
		<p v-if="project.description">{{ project.description }}</p>
		<div class="mt-1 flex">
			<a target="_blank" class="mr-4 flex items-center gap-2 text-base-content">
				<Icon
					:name="`mdi:language-${project.language.toLowerCase()}`"
					size="1.5rem"
				/>
				<span>{{ project.language }}</span>
			</a>
			<a
				v-if="project.stars > 0"
				:href="`${project.url}/stargazers`"
				target="_blank"
				class="mr-4 flex items-center gap-2 text-yellow-600"
			>
				<Icon name="mdi:star-outline" size="1.5rem" />
				<span>{{ project.stars }}</span>
			</a>
			<a
				v-if="project.forks > 0"
				:href="`${project.url}/forks`"
				target="_blank"
				class="flex items-center gap-2 text-blue-600"
			>
				<Icon name="mdi:source-fork" size="1.5rem" />
				<span>{{ project.forks }}</span>
			</a>
		</div>
	</div>
</template>
