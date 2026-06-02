<template>
  <div v-if="visible" class="prompt-overlay" @click.self="handleCancel">
    <div class="prompt-box">
      <div class="prompt-title" v-if="title">{{ title }}</div>
      
      <div v-if="content && mode !== 'prompt'" class="prompt-content">
        {{ content }}
      </div>

      <input 
        v-if="mode === 'prompt'"
        v-model="inputValue" 
        class="prompt-input" 
        :placeholder="placeholder"
        @keyup.enter="handleConfirm"
        ref="inputRef"
      />
      
      <div class="prompt-buttons">
        <button v-if="mode !== 'alert'" class="prompt-cancel" @click="handleCancel">取消</button>
        <button class="prompt-confirm" @click="handleConfirm">确定</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
  visible: Boolean,
  title: String,
  content: String,
  placeholder: String,
  initialValue: {
    type: String,
    default: ''
  },
  mode: {
    type: String,
    default: 'prompt' // alert, confirm, prompt
  }
});

const emit = defineEmits(['update:visible', 'confirm', 'cancel']);

const inputValue = ref('');
const inputRef = ref(null);

watch(() => props.visible, (newVal) => {
  if (newVal) {
    inputValue.value = props.initialValue || '';
    if (props.mode === 'prompt') {
      nextTick(() => {
        inputRef.value?.focus();
      });
    }
  }
});

const handleConfirm = () => {
  if (props.mode === 'prompt') {
    emit('confirm', inputValue.value);
  } else {
    emit('confirm', true);
  }
  emit('update:visible', false);
};

const handleCancel = () => {
  emit('cancel', false);
  emit('update:visible', false);
};
</script>

<style scoped>
.prompt-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.prompt-box {
  width: 90%;
  max-width: 350px;
  background-color: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.prompt-title {
  font-size: 16px;
  font-weight: bold;
  color: #323233;
  margin-bottom: 15px;
  text-align: center;
}

.prompt-content {
  font-size: 14px;
  color: #666;
  text-align: center;
  margin-bottom: 20px;
}

.prompt-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ebedf0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  margin-bottom: 20px;
  box-sizing: border-box;
}

.prompt-input:focus {
  border-color: #1989fa;
}

.prompt-buttons {
  display: flex;
  gap: 10px;
}

.prompt-cancel, .prompt-confirm {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

.prompt-cancel {
  background-color: #f7f8fa;
  color: #666;
}

.prompt-confirm {
  background-color: #1989fa;
  color: #fff;
}
</style>