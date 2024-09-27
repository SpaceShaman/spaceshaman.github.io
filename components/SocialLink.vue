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
    target="_blank"
    class="dark:hover:text-dark-fg-3 hover:text-light-fg-3"
  >
    <Icon :name="`uil:${name}`" size="2em" />
  </a>
</template>
