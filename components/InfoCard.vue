<script setup lang="ts">
const props = defineProps<{
  title: string;
  dates: string;
  description: string;
  url: string;
}>();
const { title, dates, description, url } = toRefs(props);
</script>

<template>
  <div class="mb-4">
    <h3
      class="text-xl font-semibold text-light-primary hover:text-light-secondary dark:text-dark-primary dark:hover:text-dark-secondary"
    >
      <a :href="url" target="_blank" rel="noopener noreferrer">
        {{ title }}
      </a>
    </h3>
    <span class="text-light-fg-3 dark:text-dark-fg-3">{{ dates }}</span>
    <p class="mt-2">
      {{ description }}
    </p>
  </div>
</template>
