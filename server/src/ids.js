// 对外 ID 用随机串而不是自增数字，避免被按序号遍历抓取。Node 22 与浏览器均有全局 crypto。
export function newId() {
  const b = crypto.getRandomValues(new Uint8Array(9));
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
