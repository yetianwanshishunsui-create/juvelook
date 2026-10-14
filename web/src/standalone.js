// 单文件测试版入口：地址带 ?admin 时显示运营后台，否则显示前台 H5（含医生端）。
// 用查询参数而不是 # 区分，切换时浏览器会整页加载，不会被前台路由改写地址。
if (new URLSearchParams(location.search).has('admin')) import('./admin/main.js');
else import('./main.js');
