<template>
  <div class="loading-state" :class="{ 'is-inline': inline }" role="status" aria-live="polite">
    <span class="loading-orb" aria-hidden="true">
      <span class="loading-orb-ring"></span>
    </span>
    <span class="loading-text">{{ text }}</span>
  </div>
</template>

<script setup>
defineProps({
  text: { type: String, default: '正在准备…' },
  inline: { type: Boolean, default: false }
});
</script>
