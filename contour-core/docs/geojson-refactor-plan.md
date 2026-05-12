# GeoJSON 模块重构与 Bug 修复计划

> 版本：v0.3.0 → v0.4.0
> 日期：2026-05-11
> 范围：`geojson.js` + `compute.js` + `index.js`
> 状态：**已完成** ✅

---

## 背景

`geojson.js` 提供三个导出函数：`toGeoJSON`（等值线）、`toFilledGeoJSON`（等值面）、`stringify`。经分析发现以下问题：

| # | 问题 | 严重程度 | 说明 |
|---|------|---------|------|
| 1 | clip 逻辑 | — | 用户要求删除 `toFilledGeoJSON` 中的 `clip` 参数及相关重叠消除逻辑 |
| 2 | 硬编码容差 0.1 | 高 | `buildLevelBoundary` 中 `isTop/isBottom/isLeft/isRight` 用 `Math.abs(pt - perimeter) < 0.1` 判断边界点，对经纬度等大范围坐标完全失效 |
| 3 | 缺少坐标参考系 | 低 | GeoJSON 输出无 `crs` 字段 |
| 4 | 平滑路径不可用 | 中 | `smooth.js` 输出 SVG path 字符串，GeoJSON 导出只能用原始折线坐标，无法生成平滑等值线 |
| 5 | `scalePathsToData` bug | 中 | 路径经 `getInterpPx` 已是数据坐标，再调用 `scalePathsToData` 会把数据坐标当网格索引用，结果错误 |
| 6 | 无测试 | 高 | `geojson.js` 无任何测试用例 |
| 7 | 等值面边界闭合逻辑缺陷 | 高 | `buildLevelBoundary` 的 edge path 拼接逻辑复杂且脆弱，边界角遍历只循环4次（`cnt < 4`），对边界数据密集的情况可能截断 |

---

## 阶段 1：删除 clip 逻辑 + 核心 Bug 修复

### 1.1 删除 `toFilledGeoJSON` 的 clip 逻辑

- 移除 `clip` 参数及所有相关代码：
  - 删除 `buildClippedPolygons` 函数（整体删除）
  - 删除 `toFilledGeoJSON` 中 `clip` 变量、`numLevels` 的 clip 分支、值取中点逻辑
  - 删除 properties 中的 `clipped`、`minValue`、`maxValue` 字段
- 每个层级直接用 `buildLevelBoundary` 生成 Polygon，不做层间裁剪

### 1.2 修复硬编码容差 0.1

- `buildLevelBoundary` 中 `isTop/isBottom/isLeft/isRight` 的 `0.1` 改为动态容差：`tol = Math.max(1e-10, range * 0.001)`
- `isOnEdgeSegment` 中的 `0.1` 同样改为动态容差
- `addBoundaryConnection` 中的 `0.1` 同样改为动态容差
- 容差从 `getDataBounds` 返回的 bounds 计算得出，传入所有需要它的函数

### 1.3 删除 `scalePathsToData`

- 从 `compute.js` 中删除 `scalePathsToData` 函数
- 从 `index.js` 的导出中移除 `scalePathsToData`

### 1.4 重写边界闭合逻辑

- 重写 `buildLevelBoundary`：
  - 去掉 4 次角遍历上限（`cnt < 4`），改为无硬性限制的顺时针边界遍历
  - edge path 拼接改为：收集所有 edge path，按起点在边界上的位置排序，依次沿边界连接
- `getNextCorner` 简化为沿边界顺时针走到下一个角

---

## 阶段 2：GeoJSON 功能增强

### 2.1 新增 `smoothCoords` 平滑坐标支持

- 在 `geojson.js` 中新增：
  - `smoothClosedCoords(pts, smoothness)` — 闭合路径 Catmull-Rom 插值，返回 `[[x,y], ...]`
  - `smoothOpenCoords(pts, smoothness)` — 开放路径 Catmull-Rom 插值
  - 复用 `smooth.js` 的 `makeTangent` 逻辑，但输出坐标数组而非 SVG path 字符串
- `toGeoJSON` 和 `toFilledGeoJSON` 新增 `options.smooth` 参数（0-1，默认 0）
- `convertPathCoordinates` 内部根据 smooth 参数决定是否做平滑

### 2.2 新增坐标变换 `transform` 选项

- `toGeoJSON` 和 `toFilledGeoJSON` 新增 `options.transform` 参数
  - 类型：`{ forward: function(x, y): [x', y'] }`
  - 在 `convertPathCoordinates` 中对每个坐标点调用 `transform.forward(x, y)`
- 典型场景：网格坐标→经纬度、网格坐标→投影坐标

### 2.3 新增 `crs` 坐标参考系选项

- `toGeoJSON` 和 `toFilledGeoJSON` 新增 `options.crs` 参数
  - 类型：`{ type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::4326' } }`
  - 默认不添加（符合 RFC 7946：默认 WGS84）
  - 传入时添加到 FeatureCollection 的 `crs` 字段

---

## 阶段 3：测试

### 3.1 单元测试 `test/unit/geojson.test.js`

| 测试用例 | 验证内容 |
|----------|---------|
| `toGeoJSON` 基础导出 | 返回合法 FeatureCollection，LineString geometry |
| `toGeoJSON` edge paths | 边界开放路径正确导出为 LineString |
| `toFilledGeoJSON` 基础导出 | 返回 Polygon FeatureCollection |
| `toFilledGeoJSON` 无 clip | 确认 clip 参数不存在，多边形不裁剪 |
| 大范围坐标 | 用经纬度数据验证容差正确（不再硬编码 0.1） |
| `smooth` 选项 | smooth > 0 时坐标点数 > 原始坐标点数 |
| `transform` 选项 | 传入坐标变换函数，验证输出坐标被正确变换 |
| `crs` 选项 | 验证 crs 字段出现在 FeatureCollection |
| 空结果处理 | levels 为空时返回空 FeatureCollection |
| `stringify` | 输出合法 JSON 字符串 |

### 3.2 集成测试

- 真实矩阵数据 → `computeContours()` → `toGeoJSON()` → 写入 `.geojson` 文件
- 用 Node.js 验证 GeoJSON 结构合法性
- 同理验证 `toFilledGeoJSON()`

---

## 阶段 4：清理与文档

### 4.1 更新 `index.js` 导出

- 移除 `scalePathsToData`
- 确认新增选项正确暴露

### 4.2 更新 README

- 更新 GeoJSON API 文档
- 标注 `clip` 已删除
- 说明 `smooth`、`transform`、`crs` 新增选项

---

## 执行顺序与依赖关系

```
阶段1.1 删除 clip ──┐
阶段1.2 修复容差 ──┼── 阶段3 测试 ── 阶段4 清理
阶段1.3 删除 scale  │
阶段1.4 重写闭合 ──┘
      │
      └── 阶段2.1 smoothCoords
      └── 阶段2.2 transform
      └── 阶段2.3 crs
```

- 阶段 1.1-1.4 可并行开发
- 阶段 2 依赖阶段 1（在修复后的代码上增加功能）
- 阶段 3 在阶段 1+2 完成后执行
- 阶段 4 收尾