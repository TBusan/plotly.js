# Contour-Core v0.3.0 - 命令使用指南

## 📦 NPM 脚本命令

所有命令都应该在 `contour-core` 目录下运行：

```bash
cd D:\study\code\webgl\plotly.js\contour-core
```

---

## 🧪 测试命令

### 运行所有测试

```bash
npm test
```
运行基础的 Node.js 测试（`test_node.js`）

### 运行完整优化测试

```bash
npm run test:all
```
运行所有 9 个优化测试，验证所有新功能

### 运行单个测试模块

```bash
npm run test:levels    # 智能刻度算法测试
npm run test:ticks     # 刻度格式化测试
npm run test:colors    # 颜色映射测试
```

---

## 🎨 Demo 命令

### 启动 Demo 服务器（推荐）

```bash
npm run demo
```
或

```bash
npm start
```

**说明**:
- 使用 Node.js 内置 HTTP 服务器
- 端口: http://localhost:8080
- 自动打开浏览器到 demo.html
- **优点**: 不需要 Python，Node.js 自带

### 使用 Python 启动（备选）

```bash
npm run demo:python
```

**说明**:
- 使用 Python 的 http.server 模块
- 需要系统已安装 Python 3

### 仅打开 Demo（不启动服务器）

```bash
npm run demo:open
```
直接在浏览器中打开 demo.html（假设服务器已运行）

---

## 📦 打包命令

### 构建浏览器版本

```bash
npm run build
```
或

```bash
npm run build:browser
```

**输出**:
- `dist/contour-core.browser.js` - 浏览器打包文件
- 包含所有依赖，无需外部模块系统
- 可直接在浏览器中使用

**使用方式**:
```html
<!-- ES6 模块方式 -->
<script type="module">
  import contourCore from './contour-core.browser.js';
  // 使用...
</script>

<!-- 传统 script 标签 -->
<script src="./contour-core.browser.js"></script>
<script>
  const result = contourCore.computeContours(grid, options);
</script>
```

---

## 📋 所有命令速查表

| 命令 | 说明 | 用途 |
|------|------|------|
| `npm test` | 基础测试 | 快速验证功能 |
| `npm run test:all` | 完整测试 | 验证所有优化 |
| `npm run test:levels` | 级别测试 | 测试智能刻度 |
| `npm run test:ticks` | 刻度测试 | 测试格式化 |
| `npm run test:colors` | 颜色测试 | 测试颜色映射 |
| `npm run demo` | 启动 Demo | **最常用** |
| `npm run demo:python` | Python 服务器 | 备选方案 |
| `npm run demo:open` | 打开浏览器 | 仅打开 |
| `npm run build` | 构建打包 | 生成浏览器版本 |
| `npm start` | 启动服务器 | 同 `npm run demo` |

---

## 🚀 快速开始

### 第一次使用

```bash
# 1. 进入目录
cd contour-core

# 2. 运行测试（验证功能）
npm run test:all

# 3. 启动 Demo（自动打开浏览器）
npm run demo

# 4. 在浏览器中测试交互式 Demo
```

### 日常开发

```bash
# 修改代码后运行测试
npm run test:all

# 启动 Demo 查看效果
npm run demo
```

### 构建生产版本

```bash
# 构建浏览器版本
npm run build

# dist/contour-core.browser.js 就是打包文件
# 可以复制到你的项目中使用
```

---

## 🌐 访问 Demo

### 本地访问

启动服务器后，在浏览器中访问：

- **主 Demo**: http://localhost:8080/demo.html
  - 交互式 Demo
  - 可调节参数
  - 实时渲染

- **简单 Demo**: http://localhost:8080/demo_simple.html
  - 4 个固定示例
  - 展示所有新功能
  - 代码参考

### 网络访问（可选）

如果需要从其他设备访问，可以：

1. **查找本机 IP**:
   ```bash
   # Windows
   ipconfig

   # Linux/Mac
   ifconfig
   ```

2. **替换 localhost**:
   ```
   http://192.168.1.xxx:8080/demo.html
   ```

---

## 📝 命令说明

### npm run demo

启动 Node.js HTTP 服务器（推荐）：
- ✅ 不需要额外安装
- ✅ 自动打开浏览器
- ✅ 显示访问日志

### npm run demo:python

使用 Python HTTP 服务器（备选）：
- ⚠️ 需要安装 Python 3
- 适合没有 Node.js 的环境

### npm run build

构建浏览器打包版本：
- 输出到 `dist/` 目录
- 生成单文件 bundle
- 无需外部依赖

---

## 🔧 故障排除

### 问题 1: 端口被占用

**错误**:
```
❌ Error: Port 8080 is already in use!
```

**解决方案**:
1. 关闭占用 8080 端口的程序
2. 或修改 `scripts/serve.js` 中的端口号：
   ```javascript
   const PORT = 8081;  // 改为其他端口
   ```

### 问题 2: 浏览器不自动打开

**解决方案**:
```bash
# 手动在浏览器中访问
http://localhost:8080/demo.html
```

### 问题 3: 模块导入错误

**错误**:
```
Cannot use import statement outside a module
```

**解决方案**:
确保 HTML 文件使用：
```html
<script type="module">
  import contourCore from './index.js';
</script>
```

---

## 📚 相关文档

- **[README.md](README.md)** - 项目主页
- **[USAGE_GUIDE.md](USAGE_GUIDE.md)** - 详细使用指南
- **[TEST_REPORT.md](TEST_REPORT.md)** - 测试报告
- **[OPTIMIZATION_COMPLETE.md](OPTIMIZATION_COMPLETE.md)** - 优化说明

---

## 🎯 常用工作流

### 开发调试

```bash
# 1. 修改代码
vim levels.js

# 2. 运行测试
npm run test:levels

# 3. 启动 Demo
npm run demo

# 4. 浏览器查看效果
# http://localhost:8080/demo.html
```

### 构建、测试、发布

```bash
# 1. 运行所有测试
npm run test:all

# 2. 构建浏览器版本
npm run build

# 3. 复制 dist/contour-core.browser.js 到项目
cp dist/contour-core.browser.js /path/to/project/

# 4. 在项目中使用
```

---

## 💡 提示

- **服务器日志**: 运行 `npm run demo` 会显示访问日志
- **停止服务器**: 在终端按 `Ctrl+C`
- **热重载**: 修改 HTML/JS 文件后刷新浏览器即可
- **端口冲突**: 如遇端口冲突，使用不同端口或关闭冲突进程

---

**版本**: v0.3.0
**更新日期**: 2025-01-26
