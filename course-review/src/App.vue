<script setup>
import { provide } from 'vue';

import { backendBase } from './config';
provide('backendBase', backendBase);

</script>

<template>
  <router-view />
</template>

<style>
/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

body {
  background-color: #f5f7fa;
  min-height: 100vh;
}
</style>
