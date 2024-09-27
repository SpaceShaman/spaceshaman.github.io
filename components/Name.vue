<script setup lang="ts">
const props = defineProps<{
  primaryText: string;
  secondaryText: string;
  isHovered: boolean;
}>();

const { primaryText, secondaryText, isHovered } = toRefs(props);
</script>
<template>
  <div class="flex justify-center">
    <div
      :class="{
        'opacity-0': isHovered,
        'opacity-100': !isHovered,
      }"
      class="absolute transition-opacity duration-500"
    >
      {{ primaryText }}
    </div>
    <div
      :class="{
        'opacity-100': isHovered,
        'opacity-0': !isHovered,
      }"
      class="transition-opacity duration-500"
    >
      {{ secondaryText }}
    </div>
  </div>
</template>
