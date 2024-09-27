<script setup lang="ts">
const educationes = [
  {
    title: "Electronics technician",
    dates: "September 2012 - June 2015",
    description: "Zespół Szkół Łączności in Poznań",
    url: "https://zsl.poznan.pl",
  },
];
</script>
<template>
  <Card title="Education">
    <InfoCard
      v-for="education in educationes"
      :key="education.title"
      :title="education.title"
      :dates="education.dates"
      :description="education.description"
      :url="education.url"
    />
  </Card>
</template>
