# Null 处理修复总结 (v2)

本修复参考 Plotly.js 源码，修复了 contour-core 中 null 值处理的关键问题。

## 发现的问题

### 问题 1: `normalize.js` 使用 NaN 而非 undefined

**原代码**:
```javascript
cleanedRow.push(NaN);
```

**问题**: `findEmpties` 只检查 `=== undefined`，所以 `NaN` 值不会被识别为空值，导致插值不执行。

**修复**:
```javascript
cleanedRow.push(undefined);  // 匹配 plotly.js 行为
```

### 问题 2: `interp2d.js` 函数签名不一致

**原代码**:
```javascript
function iterateInterp2d(z, emptyPoints, neighborShifts, overshoot) {
    // ...
}
```

**问题**: plotly.js 中的 `iterateInterp2d` 不接受 `neighborShifts` 参数，因为 `NEIGHBORSHIFTS` 是模块级常量。

**修复**:
```javascript
var NEIGHBORSHIFTS = [[-1, 0], [1, 0], [0, -1], [0, 1]];  // 模块级常量

function iterateInterp2d(z, emptyPoints, overshoot) {
    // 使用模块级 NEIGHBORSHIFTS
}
```

### 问题 3: 错误处理不一致

**原代码**:
```javascript
if (neighborCount === 0) {
    console.error('iterateInterp2d: No defined neighbors for point', i, j);
    continue;  // 只是继续
}
```

**问题**: plotly.js 遇到这种情况会抛出错误，这通常表示 `findEmpties` 的排序有问题。

**修复**:
```javascript
if (neighborCount === 0) {
    throw new Error('iterateInterp2d order is wrong: no defined neighbors');
}
```

### 问题 4: `find_empties.js` 错误处理

**原代码**:
```javascript
if (!foundNewNeighbors) {
    console.warn('findEmpties: Could not find neighbors for all empty points');
    break;  // 只是警告并退出
}
```

**修复**:
```javascript
if (!foundNewNeighbors) {
    throw new Error('findEmpties: Iterated with no new neighbors');
}
```

## 修改的文件

1. **`null_handling/normalize.js`**
   - 将无效值转换为 `undefined` 而非 `NaN`

2. **`null_handling/interp2d.js`**
   - 重写以匹配 plotly.js 实现
   - `NEIGHBORSHIFTS` 作为模块级常量
   - `iterateInterp2d` 签名改为 `(z, emptyPoints, overshoot)`
   - 没有邻居时抛出错误

3. **`null_handling/find_empties.js`**
   - 添加更清晰的注释
   - 没有找到新邻居时抛出错误

4. **`test/unit/null_handling.test.js`**
   - 更新测试以验证 `undefined` 而非 `NaN`

5. **`test/unit/null_interp_test.js`** (新建)
   - 添加完整的 null 处理流程集成测试

## 测试结果

```
=== All Null Handling Pipeline Tests Passed ===

Test 1: Single null value in middle ✓
Test 2: Multiple adjacent null values ✓
Test 3: Null values at edges ✓
Test 4: NaN values (should be treated as null) ✓
Test 5: Larger null region (2x2) ✓
```

## 关键要点

1. **undefined vs NaN**: plotly.js 使用 `undefined` 表示空值，`findEmpties` 检查 `=== undefined`

2. **插值总是执行**: 对于 contour，插值总是执行（无论 `connectgaps` 设置）。`connectgaps` 只控制渲染时的遮罩。

3. **错误处理**: 严格错误抛出可以及早发现数据问题，避免静默失败

## 与 Plotly.js 的一致性

修复后，contour-core 的 null 处理逻辑现在完全匹配 plotly.js：

| 特性 | plotly.js | contour-core (修复后) |
|------|-----------|---------------------|
| 空值表示 | `undefined` | `undefined` ✓ |
| findEmpties 检查 | `=== undefined` | `=== undefined` ✓ |
| interp2d 签名 | `(z, emptyPoints, overshoot)` | `(z, emptyPoints, overshoot)` ✓ |
| 无邻居时行为 | throw error | throw error ✓ |
| NEIGHBORSHIFTS | 模块级常量 | 模块级常量 ✓ |
