<script setup lang="ts">
const colorMode = useColorMode();
function toggleColorMode() {
  if (colorMode.value === "dark") {
    colorMode.preference = "light";
  } else {
    colorMode.preference = "dark";
  }
}
const icon = computed(() => {
  if (colorMode.value === "dark") {
    return "line-md:moon-alt-loop";
  } else {
    return "line-md:sun-rising-loop";
  }
});
</script>
<template>
  <Icon
    :name="icon"
    size="2em"
    class="hover:text-light-fg-3 dark:hover:text-dark-fg-3 cursor-pointer rounded-full p-1"
    @click="toggleColorMode"
  />
</template>
