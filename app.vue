<script setup lang="ts">
useHead({
  bodyAttrs: {
    style: "user-select: none;",
  },
  link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
});
useSeoMeta({
  title: "Krzysztof Stanisławski - Fullstack Developer",
  description:
    "Krzysztof Stanisławski - Fullstack Developer. I'm a fullstack developer with a passion for creating advanced web applications.",
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
