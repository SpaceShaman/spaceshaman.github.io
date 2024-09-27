<script setup lang="ts">
const socialLinks = [
  {
    name: "github",
    url: "https://github.com/SpaceShaman",
  },
  {
    name: "linkedin",
    url: "https://www.linkedin.com/in/krzysztof-stanislawski",
  },
];
const technologyBadges = [
  {
    name: "Python",
    url: "https://www.python.org/",
  },
  {
    name: "TypeScript",
    url: "https://www.typescriptlang.org/",
  },
  {
    name: "Django",
    url: "https://www.djangoproject.com/",
  },
  {
    name: "FastAPI",
    url: "https://fastapi.tiangolo.com/",
  },
  {
    name: "Nuxt.js",
    url: "https://nuxt.com/",
  },
  {
    name: "Docker",
    url: "https://www.docker.com/",
  },
  {
    name: "Docker Compose",
    url: "https://docs.docker.com/compose/",
  },
  {
    name: "Pydantic",
    url: "https://docs.pydantic.dev",
  },
  {
    name: "Django Ninja",
    url: "https://django-ninja.dev/",
  },
  {
    name: "Celery",
    url: "https://docs.celeryproject.org/en/",
  },
  {
    name: "Transformers",
    url: "https://huggingface.co/transformers/",
  },
  {
    name: "Marvin",
    url: "https://www.askmarvin.ai/",
  },
  {
    name: "Pytest",
    url: "https://docs.pytest.org/",
  },
  {
    name: "Factory Boy",
    url: "https://factoryboy.readthedocs.io",
  },
  {
    name: "Tailwind CSS",
    url: "https://tailwindcss.com/",
  },
  {
    name: "Clean Architecture",
    url: "https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html",
  },
  {
    name: "TDD",
    url: "https://en.wikipedia.org/wiki/Test-driven_development",
  },
  {
    name: "DDD",
    url: "https://en.wikipedia.org/wiki/Domain-driven_design",
  },
  {
    name: "Code style: black",
    url: "https://github.com/psf/black",
  },
  {
    name: "Linting: Ruff",
    url: "https://github.com/astral-sh/ruff",
  },
  {
    name: "Material for MkDocs",
    url: "https://squidfunk.github.io/mkdocs-material/",
  },
];
const email = "stanislawski@tuta.io";
const telephone = "+48 790 228 481";
const shortDescription =
  "I'm a fullstack developer with a passion for creating advanced web applications.";
const personIsHovered = ref(false);
</script>
<template>
  <Card class="relative flex flex-col items-center">
    <ColorModeButton class="absolute left-2 top-2 z-50" />
    <div
      @mouseover="personIsHovered = true"
      @mouseleave="personIsHovered = false"
      class="relative w-full"
    >
      <Avatar :isHovered="personIsHovered" />
      <Name
        class="mt-4 whitespace-nowrap text-lg font-bold max-md:text-2xl lg:text-2xl"
        primary-text="Krzysztof Stanisławski"
        secondary-text="SpaceShaman"
        :isHovered="personIsHovered"
      />
    </div>
    <h2
      class="mt-2 whitespace-nowrap text-lg font-semibold text-light-primary dark:text-dark-primary"
    >
      Fullstack Developer
    </h2>
    <p class="mt-2 text-center">
      {{ shortDescription }}
    </p>
    <!-- Technology -->
    <div class="mt-4 w-full">
      <div class="mt-2 flex flex-wrap">
        <TechnologyBadge
          v-for="badge in technologyBadges"
          :key="badge.name"
          :name="badge.name"
          :url="badge.url"
        />
      </div>
    </div>
    <div class="flex w-full flex-col items-center">
      <PrintButton />
      <!-- Social links -->
      <div class="mt-6 flex space-x-4">
        <SocialLink
          v-for="link in socialLinks"
          :key="link.name"
          :name="link.name"
          :url="link.url"
        />
      </div>
      <!-- Email -->
      <div class="mt-4 text-center">
        <a
          :href="`mailto:${email}`"
          class="font-bold hover:text-light-fg-3 dark:hover:text-dark-fg-3"
          >{{ email }}</a
        >
      </div>
      <!-- Telephone -->
      <div class="mt-4 text-center">
        <a
          :href="`tel:${telephone.replace(/\s+/g, '')}`"
          class="font-bold hover:text-light-fg-3 dark:hover:text-dark-fg-3"
          >{{ telephone }}</a
        >
      </div>
    </div>
  </Card>
</template>
