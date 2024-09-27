<script setup lang="ts">
const props = defineProps<{
  title?: string;
}>();
const { title } = toRefs(props);
</script>

<template>
  <div class="dark:bg-dark-bg bg-light-bg mb-6 rounded-lg p-6 shadow-lg">
    <h2
      v-if="title"
      class="dark:border-dark-fg border-light-fg mb-4 border-b pb-3 text-2xl font-bold"
    >
      {{ title }}
    </h2>
    <slot />
  </div>
</template>
