<template>
  <router-view />
  <!-- 全局弹窗组件 -->
  <CustomModal 
    v-model:visible="modalVisible"
    :mode="modalMode"
    :title="modalTitle"
    :content="modalContent"
    :placeholder="modalPlaceholder"
    @confirm="handleModalConfirm"
    @cancel="handleModalCancel"
  />
</template>

<script setup>
import { provide, ref } from 'vue';
import CustomModal from './components/CustomPrompt.vue';

const backendBase = import.meta.env.DEV ? 'http://127.0.0.1:5000' : '';
provide('backendBase', backendBase);

const modalVisible = ref(false);
const modalMode = ref('alert');
const modalTitle = ref('');
const modalContent = ref('');
const modalPlaceholder = ref('');
let modalResolve = null;

const showModal = ({ mode, title, content = '', placeholder = '' }) => {
  // 防止连续弹出时重置不及时
  modalVisible.value = false;
  
  setTimeout(() => {
    modalMode.value = mode;
    modalTitle.value = title;
    // 如果没有传 title，内容直接当做 title 显示即可
    if (!title && content) {
      modalTitle.value = content;
      modalContent.value = '';
    } else {
      modalContent.value = content;
    }
    modalPlaceholder.value = placeholder;
    modalVisible.value = true;
  }, 10);

  return new Promise((resolve) => {
    modalResolve = resolve;
  });
};

const showAlert = (title, content = '') => showModal({ mode: 'alert', title, content });
const showConfirm = (title, content = '') => showModal({ mode: 'confirm', title, content });
const showPrompt = (title, placeholder = '') => showModal({ mode: 'prompt', title, placeholder });

provide('showAlert', showAlert);
provide('showConfirm', showConfirm);
provide('showPrompt', showPrompt);

const handleModalConfirm = (val) => {
  if (modalResolve) modalResolve(val);
  modalResolve = null;
};

const handleModalCancel = () => {
  if (modalResolve) modalResolve(null);
  modalResolve = null;
};
</script>

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
