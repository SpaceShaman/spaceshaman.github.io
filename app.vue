<script setup lang="ts">
useHead({
  bodyAttrs: {
    style: "user-select: none;",
  },
  link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
});
</script>
<template>
  <div class="mx-auto max-w-7xl p-4">
    <div class="md:flex md:space-x-6">
      <LeftSection class="md:w-1/3" />
      <RightSection />
    </div>
  </div>
</template>
<style>
.dark-mode {
  @apply bg-dark-bg-0-h text-dark-fg;
}
.light-mode {
  @apply bg-light-bg-0-h text-light-fg;
}
</style>
