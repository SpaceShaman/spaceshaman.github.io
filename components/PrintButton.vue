<script setup lang="ts">
function printPage() {
  const printStyles = `
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            size: auto;
            margin: 10mm;
          }
        }
      `;
  const styleSheet = document.createElement("style");
  styleSheet.innerText = printStyles;
  document.head.appendChild(styleSheet);
  window.print();
}
</script>
<template>
  <button
    @click="printPage"
    class="dark:bg-dark-primary bg-light-primary hover:dark:bg-dark-secondary hover:bg-light-secondary no-print mt-6 w-full rounded-lg px-4 py-2 text-sm font-bold"
  >
    Print CV
  </button>
</template>
<style>
@media print {
  .no-print {
    display: none;
  }
}
</style>
