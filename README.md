# juvelook 认证查询系统（一期）

面向微信公众号的认证查询 H5 + 运营后台 + 扫码验真核销。合同范围见《juvelook 认证查询系统（一期）软件技术开发合同》。

## 进度

| # | 合同交付项 | 状态 |
|---|---|---|
| 1 | 前台查询 H5：医生 / 机构查询、模糊搜索、城市筛选、详情页、医生 ↔ 机构互跳、品牌视觉、响应式 / 深色适配 | ✅ 已完成 |
| 3 | 后端 API 与数据库：医生 / 机构 / 授权 / 支数 / 核销记录模型，前台查询接口 | 🟡 查询部分完成，后台与核销接口待做 |
| 2 | 运营管理后台（登录鉴权、医生 / 机构管理、Excel 批量导入） | ⏳ 待开发 |
| 4 | 扫码验真联动（医生登录 + 微信扫一扫、接入华熙验真 API、一码一核销） | ⏳ 待开发，需客户提供正式接口与鉴权方式 |
| 5 | 部署上线与公众号对接 | ⏳ 待服务器 / 域名 / 备案 |

## 目录

```
juvelook/
├── server/        后端 API（Node 22 + Express + 内置 SQLite）
│   ├── src/db.js        表结构与迁移（orgs / doctors / scans）
│   ├── src/queries.js   前台公开查询
│   ├── src/app.js       路由、限流、静态托管
│   └── test/            接口测试（node --test）
└── web/           公众号 H5 前台（Vue 3 + Vite，hash 路由）
```

## 本地开发

需要 Node.js ≥ 22.13（使用内置 `node:sqlite`，无需编译原生依赖）。

```bash
npm run install:all
npm run seed                 # 写入演示数据（仅库为空时）
npm --prefix server run dev  # API: http://localhost:3100
npm --prefix web run dev     # H5:  http://localhost:5173（/api 自动代理到 3100）
npm test                     # 接口测试
```

## 生产部署

```bash
npm run install:all && npm run build
PORT=3100 DB_FILE=/var/lib/juvelook/juvelook.db npm start
```

同一进程同时提供 `/api` 与 H5 静态文件（`web/dist`）。前置 Nginx 负责 HTTPS，反代到 3100 端口。

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3100` | 监听端口 |
| `DB_FILE` | `data/juvelook.db` | SQLite 数据库文件 |
| `STATIC_DIR` | `web/dist` | H5 构建产物目录 |

## API（前台公开）

| 接口 | 说明 |
|---|---|
| `GET /api/meta` | 医生数、机构数、有认证医生的城市列表 |
| `GET /api/doctors?q=&city=` | 医生查询，姓名模糊或认证编号精确匹配；`q` 与 `city` 至少一个 |
| `GET /api/doctors/:id` | 医生详情，含所在机构与两品类支数 |
| `GET /api/orgs?q=` | 机构查询，名称模糊或授权编号精确匹配 |
| `GET /api/orgs/:id` | 机构详情，含授权产品、累计支数、名下医生 |

支数字段为 `null` 表示所在机构未授权该品类，前台显示「未授权」。

## 设计说明

- **防抓取**：对外 ID 为随机串（不可按序号遍历）；查询必须带关键词或城市，不提供全量列表；单次最多返回 50 条；`/api` 按 IP 限流 120 次 / 分钟。
- **认证状态**：医生 / 机构有 `status` 字段，撤销后前台立即不可查。
- **字体**：Jost（Futura 的开源等效字体）随构建本地打包，不依赖 Google Fonts（国内无法访问）。中文使用系统字体。如客户提供 Futura Web Font 授权，替换 `web/src/main.js` 中的字体引入即可。
- **hash 路由**：落地页 URL 不随页面切换变化，后续接微信 JS-SDK 时只需对一个地址签名。
- **支数归属**：`doctors.blue_count / black_count` 存累计值；扫码核销时在同一事务内写入 `scans`（防伪码唯一约束保证一码一核销）并累加对应医生支数。

## 待客户确认

- 验真接口：测试接口为 HTTP、无鉴权，返回的 `code` 为字符串 `"200"`（美团规范为整数）；需确认正式环境的 HTTPS 地址、鉴权方式，以及如何从返回中区分 JUVELOOK / Volume 品类（`product_name` 还是编码段）。
- 是否展示认证编号；医生 / 机构编号规则。
- 公开展示支数的合规口径。
