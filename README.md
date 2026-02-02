# ⚡ BiaoSUB

轻量级订阅聚合管理面板，基于 Cloudflare Pages + D1 数据库，零成本部署。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages-orange.svg)

## ✨ 功能特性

- 🔗 **多协议支持** - VMess、VLESS、Trojan、Shadowsocks、Hysteria2、TUIC 等
- 📦 **资源池管理** - 统一管理订阅链接和自建节点
- 🔀 **聚合订阅** - 将多个资源组合成一个订阅链接
- ⚙️ **Clash 配置生成** - 自动生成策略组和分流规则
- 📝 **模板系统** - 保存和复用自定义配置模板
- 🌐 **托管模式** - 直接上传完整 YAML 配置
- 🔐 **密码保护** - 管理面板安全访问
- 💾 **数据备份** - 导出/导入配置数据

## 🚀 部署教程 (Cloudflare Pages)

### 前置要求

- GitHub 账号
- Cloudflare 账号

### 第一步：Fork 项目

1. 访问 [BiaoSUB GitHub 仓库](https://github.com/0xdabiaoge/Biao-Sub)
2. 点击右上角 **Fork** 按钮
3. 将项目 Fork 到自己的 GitHub 账号

### 第二步：创建 D1 数据库

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 左侧菜单选择 **Workers 和 Pages** → **D1 SQL 数据库**
3. 点击 **创建数据库**
4. 输入数据库名称（例如：`biaosub-db`）
5. 点击 **创建**

### 第三步：初始化数据库表

在 D1 数据库控制台中，进入 **控制台** 标签，依次执行以下 SQL 命令：

```sql
-- 1. 创建订阅资源表
CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT DEFAULT 'subscription',
    info TEXT,
    params TEXT,
    status INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 创建聚合组表
CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    config TEXT,
    status INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. 创建模板表
CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    header TEXT,
    groups TEXT,
    rules TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

> ⚠️ **注意**：每条 SQL 命令需要单独执行，不要一次性粘贴全部。

### 第四步：创建 Pages 项目

1. 在 Cloudflare Dashboard 中，选择 **Workers 和 Pages**
2. 点击 **创建** → **Pages** → **连接到 Git**
3. 选择 **GitHub**，授权并选择你 Fork 的 `Biao-Sub` 仓库
4. 配置构建设置：
   - **项目名称**：自定义（例如：`biaosub`）
   - **框架预设**：无
   - **生产分支**：`main`
   - **构建命令**：`npm install`
   - **构建输出目录**：`public`
5. 点击 **保存并部署**

### 第五步：绑定 D1 数据库

1. 进入刚创建的 Pages 项目
2. 点击 **设置** → **Functions** → **D1 数据库绑定**
3. 点击 **添加绑定**：
   - **变量名称**：`DB`（必须是 `DB`，大写）
   - **D1 数据库**：选择之前创建的数据库
4. 点击 **保存**

### 第六步：配置环境变量

1. 在 Pages 项目中，点击 **设置** → **环境变量**
2. 点击 **添加变量**：
   - **变量名称**：`ADMIN_PASSWORD`
   - **值**：设置你的管理密码
3. 点击 **保存**

### 第七步：重新部署

1. 进入 **部署** 标签页
2. 找到最新的部署，点击右侧 **⋮** → **重试部署**
3. 等待部署完成

### 第八步：访问面板

- 访问：`https://你的项目名.pages.dev`
- 输入管理密码登录

---

## 📖 使用说明

### 添加资源

1. 点击 **资源池** → **添加资源**
2. 类型选择：
   - **订阅链接** - 机场订阅地址
   - **自建节点** - 单个或多个节点链接
3. 填写名称和链接，保存

### 创建聚合组

1. 点击 **聚合订阅组** → **新建聚合组**
2. 选择配置模板：
   - **默认模板** - 预置规则和策略组
   - **空白模板** - 完全自定义
   - **托管配置** - 上传完整 YAML
   - **我的模板** - 使用已保存的模板
3. 选择要包含的资源
4. 配置策略组和规则
5. 保存后复制订阅链接

### 订阅格式

- **Clash 格式**：`https://域名/api/g/TOKEN`
- **Base64 格式**：`https://域名/api/g/TOKEN?format=base64`

---

## 🛠️ 技术栈

- **前端**：Vue 3 + Tailwind CSS + DaisyUI
- **后端**：Cloudflare Pages Functions (Hono)
- **数据库**：Cloudflare D1 (SQLite)
- **拖拽排序**：SortableJS

---

## 📝 更新日志

### v1.0.0
- 初始版本发布
- 支持多种代理协议
- Clash 配置生成
- 模板管理系统
- 数据备份/恢复

---

## 📜 开源协议

本项目基于 [MIT License](LICENSE) 开源。

---

## 🙏 致谢

感谢所有贡献者和用户的支持！

如有问题或建议，欢迎提交 [Issue](https://github.com/0xdabiaoge/Biao-Sub/issues)。
