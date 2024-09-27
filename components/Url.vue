<script setup lang="ts">
const props = defineProps<{
  href: string;
}>();
const { href } = toRefs(props);
</script>
<template>
  <a
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    class="text-light-primary hover:text-light-secondary dark:text-dark-primary dark:hover:text-dark-secondary"
  >
    <slot />
  </a>
</template>
