<script setup lang="ts">
	import projects from '~/data/projects.json'
</script>
<template>
	<Card title="Open Source Projects">
		<CardItem
			v-for="(project, index) in projects"
			:key="index"
			:title="project.name"
			:url="project.url"
			:description="project.description"
		>
			<div class="mt-1 flex">
				<a
					target="_blank"
					class="mr-4 flex items-center gap-2 text-base-content text-gray-600 dark:text-gray-300"
				>
					<Icon
						v-if="project.language == 'Vue'"
						name="mdi:vuejs"
						size="1.5rem"
					/>
					<Icon
						v-else
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
		</CardItem>
	</Card>
</template>
