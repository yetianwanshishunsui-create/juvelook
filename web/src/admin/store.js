import { reactive } from 'vue';

export const session = reactive({
  user: null,
  checked: false,
  onExpired: null,
  expired() {
    this.user = null;
    this.onExpired?.();
  },
});

// 轻提示
export const toast = reactive({
  msg: '',
  kind: 'ok',
  timer: 0,
  show(msg, kind = 'ok') {
    this.msg = msg;
    this.kind = kind;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => (this.msg = ''), 2400);
  },
});

// 确认弹窗（Promise 风格）
export const confirmBox = reactive({
  open: false,
  title: '',
  text: '',
  okText: '确定',
  danger: false,
  resolve: null,
  ask({ title, text, okText = '确定', danger = false }) {
    Object.assign(this, { open: true, title, text, okText, danger });
    return new Promise((r) => (this.resolve = r));
  },
  close(v) {
    this.open = false;
    this.resolve?.(v);
  },
});
