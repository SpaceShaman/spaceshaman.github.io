<script setup lang="ts">
const experiances = [
  {
    title: "Fullstack Developer in Quadra-Net",
    dates: "October 2021 - Present",
    description: `Development and maintenance of IT systems that I create myself,
    including an application for managing employee vacations in the company,
    a warehouse system with a used parts store,
    a statistical system for analyzing the results of our business partners,
    and a system for managing scripts automating our processes. Additionally,
    I am also involved in automating manual processes within the company.`,
    url: "https://quadra-net.pl",
  },
];
</script>
<template>
  <Card title="Experiance">
    <InfoCard
      v-for="experiance in experiances"
      :key="experiance.title"
      :title="experiance.title"
      :dates="experiance.dates"
      :description="experiance.description"
      :url="experiance.url"
    />
  </Card>
</template>
