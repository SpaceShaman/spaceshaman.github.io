<script setup lang="ts">
const props = defineProps<{
  name: string;
  url: string;
}>();
const { name, url } = toRefs(props);
</script>
<template>
  <a
    :href="url"
    class="dark:bg-dark-fg-2 dark:hover:bg-dark-fg dark:text-dark-bg bg-light-fg-2 hover:bg-light-fg text-light-bg mb-2 mr-2 rounded-lg px-3 py-1 text-xs font-medium"
  >
    {{ name }}</a
  >
</template>
