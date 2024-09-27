<script setup lang="ts">
const props = defineProps<{
  isHovered: boolean;
}>();
const { isHovered } = toRefs(props);
</script>
<template>
  <div class="relative flex w-full justify-center">
    <div
      :class="{
        'opacity-0': isHovered,
        'opacity-100': !isHovered,
      }"
      class="absolute transition-opacity duration-500"
    >
      <img
        src="assets/avatar-0.jpeg"
        alt="Avatar"
        class="dark:border-dark-primary border-light-primary h-40 w-40 rounded-full border-4 object-cover"
      />
    </div>
    <div
      :class="{
        'opacity-100': isHovered,
        'opacity-0': !isHovered,
      }"
      class="transition-opacity duration-500"
    >
      <img
        src="assets/avatar-1.png"
        alt="Avatar"
        class="dark:border-dark-primary border-light-primary h-40 w-40 rounded-full border-4 object-cover"
      />
    </div>
  </div>
</template>
