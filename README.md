# ⚡ BiaoSUB

轻量级订阅聚合管理面板，基于 Cloudflare Pages + D1 数据库，零成本部署。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages-orange.svg)

## ✨ 功能特性

- 🔗 **多协议支持** - VMess、VLESS、Trojan、Shadowsocks、Hysteria2、TUIC、AnyTLS
- 📦 **资源池管理** - 统一管理的节点组和独立节点
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
2. 左侧菜单选择 **存储和数据库** → **D1 SQL 数据库**
3. 点击 **创建数据库**
4. 输入数据库名称（自定义名称即可）
5. 点击 **创建**

### 第三步：初始化数据库表

在 D1 数据库控制台中，进入 **控制台** 标签，执行以下 SQL 命令：

#### 方案 A：全新部署（首次安装）
复制粘贴执行以下全部内容：

```sql
CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT DEFAULT 'subscription',
    info TEXT,
    params TEXT,
    status INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    config TEXT,
    clash_config TEXT,
    status INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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

#### 方案 B：旧版本升级（保留数据）
如果你是从旧版本升级，请依次执行以下迁移命令：

```sql

ALTER TABLE subscriptions ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE groups ADD COLUMN clash_config TEXT;
ALTER TABLE groups ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

```

> ⚠️ **注意**：如果执行 `ALTER TABLE` 报错提示列已存在，可以忽略。执行完成后重新保存聚合组即可生效。

### 第四步：创建 Pages 项目

1. 在左侧栏中，选择 **计算和AI**
2. 点击 **创建应用程序** → **点击底部的开始使用** → **导入现有 Git 存储库**
3. 选择 **GitHub**，授权并选择你 Fork 的 **Biao-Sub仓库** → **开始设置**
4. 配置构建设置：
   - **项目名称**：自定义输入
   - **生产分支**：`main`
   - **框架预设**：无
   - **构建命令**：`npm install`
   - **构建输出目录**：`public`
5. 点击 **保存并部署**

### 第五步：绑定 D1 数据库

1. 进入刚创建的 Pages 项目
2. 点击 **设置** → **绑定** → **添加**
3. 点击 **D1 数据库**：
   - **变量名称**：`DB`（必须是 `DB`，大写）
   - **D1 数据库**：选择之前创建的数据库
4. 点击 **保存**

### 第六步：配置环境变量

1. 在 Pages 项目中，点击 **设置** → **变量和机密**
2. 点击 **添加**：
   - **变量名称**：`ADMIN_PASSWORD`
   - **值**：设置你的管理密码
3. 点击 **保存**

### 第七步：重新部署

1. 进入 **部署** 标签页
2. 找到最新的部署，点击右侧 **...** → **重试部署**
3. 等待部署完成

### 第八步：访问面板

- 访问：`最新部署的：https://你的项目名.pages.dev`
- 输入管理密码登录

---

## 📖 使用说明

### 添加资源

1. 点击 **资源池** → **添加资源**
2. 类型选择：
   - **节点组** - 多个节点链接组合成一个节点组
   - **单独节点** - 单个或多个节点链接
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

## 🙏 结语

- 本项目完全由调教AI所得，并由CF部署驱动，可能会存在诸多深层次的BUG和问题没有被发现，仍需要时间去实际测试使用。欢迎Fork进行二次创造！
- **最后**，本项目需要对Clash Yaml配置文件有一定的熟悉了解，不太熟悉的话，配置起来会比较难以实行，建议多找AI沟通。


## 📝 更新日志

### 2026.02.04
- **彻底重构**：原始版本存在诸多问题，且代码间互联性太强，修改一个极容易导致其他功能受到影响，故此彻底重构拆分。
- **优化节点协议解析**：大部分常用的节点协议及类型均以支持，除部分冷门节点类型尚未支持解析，基本日常使用都能够应付。
- **拖拽排序再次优化**：目前拖拽排序功能基本完好，排序好的节点或者节点组，在yaml配置文件中也会跟随排序。