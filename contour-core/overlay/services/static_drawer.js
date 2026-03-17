'use strict';

/**
 * StaticDrawer - 静态绘制服务
 * 职责：将数据添加到 Overlay，并触发渲染
 *
 * 设计模式：命令模式
 * - 每个绘制操作是一个命令
 * - 命令只知道 overlay 和 refresh
 */
function StaticDrawer(overlay, refreshCallback) {
    this._overlay = overlay;
    this._refresh = refreshCallback || function() {};
}

StaticDrawer.prototype = {
    /**
     * 绘制点
     * @param {number} x - X 坐标（数据坐标）
     * @param {number} y - Y 坐标（数据坐标）
     * @param {Object} options - 点选项
     * @param {string} [options.id] - 可选的自定义ID
     * @returns {string} 元素ID
     */
    drawPoint: function(x, y, options) {
        var opts = options || {};
        var id = this._overlay.add('point', {
            x: x,
            y: y,
            options: opts,
            id: opts.id  // 传入自定义 ID（如果有）
        });
        this._refresh();
        return id;
    },

    /**
     * 绘制线
     * @param {Array} points - 点数组 [{x, y} 或 [x, y]]
     * @param {Object} options - 线选项
     * @param {string} [options.id] - 可选的自定义ID
     * @returns {string} 元素ID
     */
    drawLine: function(points, options) {
        var opts = options || {};
        var id = this._overlay.add('line', {
            points: this._normalizePoints(points),
            options: opts,
            id: opts.id  // 传入自定义 ID（如果有）
        });
        this._refresh();
        return id;
    },

    /**
     * 绘制多边形
     * @param {Array} points - 点数组 [{x, y} 或 [x, y]]
     * @param {Object} options - 多边形选项
     * @param {string} [options.id] - 可选的自定义ID
     * @returns {string} 元素ID
     */
    drawPolygon: function(points, options) {
        var opts = options || {};
        var id = this._overlay.add('polygon', {
            points: this._normalizePoints(points),
            options: opts,
            id: opts.id  // 传入自定义 ID（如果有）
        });
        this._refresh();
        return id;
    },

    /**
     * 绘制文本
     * @param {number} x - X 坐标（数据坐标）
     * @param {number} y - Y 坐标（数据坐标）
     * @param {string} content - 文本内容
     * @param {Object} options - 文本选项
     * @param {string} [options.id] - 可选的自定义ID
     * @returns {string} 元素ID
     */
    drawText: function(x, y, content, options) {
        var opts = options || {};
        var id = this._overlay.add('text', {
            x: x,
            y: y,
            content: content,
            options: opts,
            id: opts.id  // 传入自定义 ID（如果有）
        });
        this._refresh();
        return id;
    },

    /**
     * 批量绘制（性能优化：只触发一次 refresh）
     * @param {Array} items - 元素数组 [{type, data}]
     * @returns {Array} 元素ID数组
     */
    drawBatch: function(items) {
        var ids = [];
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            ids.push(this._drawWithoutRefresh(item.type, item.data));
        }
        this._refresh();
        return ids;
    },

    /**
     * 更新元素
     * @param {string} id - 元素ID
     * @param {Object} data - 更新数据
     * @returns {Object|null} 更新后的元素
     */
    update: function(id, data) {
        var result = this._overlay.update(id, data);
        this._refresh();
        return result;
    },

    /**
     * 删除元素
     * @param {string} id - 元素ID
     * @returns {boolean} 是否删除成功
     */
    remove: function(id) {
        var result = this._overlay.remove(id);
        this._refresh();
        return result;
    },

    /**
     * 更新元素的ID
     * @param {string} oldId - 旧ID
     * @param {string} newId - 新ID
     * @returns {Object|null} 更新后的元素，失败返回 null
     */
    updateId: function(oldId, newId) {
        var result = this._overlay.updateId(oldId, newId);
        this._refresh();
        return result;
    },

    /**
     * 只更新样式（不影响数据）
     * @param {string} id - 元素ID
     * @param {Object} style - 样式对象
     * @returns {Object|null} 更新后的元素
     */
    updateStyle: function(id, style) {
        var item = this._overlay.get(id);
        if (!item) return null;

        // 确保 options 对象存在
        if (!item.options) {
            item.options = {};
        }

        // 只更新样式属性到 options 中
        var styleProps = [
            // 通用样式
            'color', 'opacity', 'visible',
            // 点样式
            'size', 'shape', 'strokeColor', 'strokeWidth',
            // 线样式
            'width', 'lineWidth', 'lineDash', 'lineCap', 'lineJoin',
            // 多边形样式
            'fill', 'fillColor', 'stroke', 'strokeColor',
            // 文字样式
            'fontSize', 'fontFamily', 'fontWeight', 'fontStyle',
            'textAlign', 'textBaseline', 'angle', 'offsetX', 'offsetY',
            'backgroundColor', 'padding', 'borderRadius', 'borderColor', 'borderWidth'
        ];

        for (var i = 0; i < styleProps.length; i++) {
            var prop = styleProps[i];
            if (style[prop] !== undefined) {
                item.options[prop] = style[prop];
            }
        }

        // 支持直接传入 options 对象
        if (style.options) {
            Object.assign(item.options, style.options);
        }

        this._refresh();
        return item;
    },

    /**
     * 只更新数据（不影响样式）
     * @param {string} id - 元素ID
     * @param {Object} data - 数据对象
     * @returns {Object|null} 更新后的元素
     */
    updateData: function(id, data) {
        var item = this._overlay.get(id);
        if (!item) return null;

        switch (item.type) {
            case 'point':
                // 点数据：x, y
                if (data.x !== undefined) item.x = data.x;
                if (data.y !== undefined) item.y = data.y;
                break;

            case 'line':
            case 'polygon':
                // 线/多边形数据：points
                if (data.points !== undefined) {
                    item.points = this._normalizePoints(data.points);
                }
                break;

            case 'text':
                // 文字数据：x, y, content
                if (data.x !== undefined) item.x = data.x;
                if (data.y !== undefined) item.y = data.y;
                if (data.content !== undefined) item.content = data.content;
                break;
        }

        this._refresh();
        return item;
    },

    /**
     * 批量更新样式
     * @param {Array} ids - 元素ID数组
     * @param {Object} style - 样式对象
     * @returns {Array} 更新成功的元素数组
     */
    updateStyles: function(ids, style) {
        var self = this;
        var updated = [];
        for (var i = 0; i < ids.length; i++) {
            var item = this.updateStyle(ids[i], style);
            if (item) updated.push(item);
        }
        // updateStyle 已经调用了 refresh，这里不需要再调用
        return updated;
    },

    /**
     * 批量更新数据
     * @param {Array} dataList - 数据列表 [{id, ...data}]
     * @returns {Array} 更新成功的元素数组
     */
    updateDataList: function(dataList) {
        var updated = [];
        for (var i = 0; i < dataList.length; i++) {
            var data = dataList[i];
            var id = data.id;
            if (id) {
                var item = this._overlay.get(id);
                if (item) {
                    // 复制数据，移除 id 字段
                    var updateData = Object.assign({}, data);
                    delete updateData.id;
                    this.updateData(id, updateData);
                    updated.push(item);
                }
            }
        }
        this._refresh();
        return updated;
    },

    // ========================================
    // 内部方法
    // ========================================

    _drawWithoutRefresh: function(type, data) {
        return this._overlay.add(type, data);
    },

    _normalizePoints: function(points) {
        if (!Array.isArray(points)) return [];

        return points.filter(function(p) {
            if (!p) return false;
            var x = p.x !== undefined ? p.x : p[0];
            var y = p.y !== undefined ? p.y : p[1];
            return typeof x === 'number' && isFinite(x) &&
                   typeof y === 'number' && isFinite(y);
        }).map(function(p) {
            if (Array.isArray(p)) {
                return { x: p[0], y: p[1] };
            }
            return { x: p.x, y: p.y };
        });
    }
};

module.exports = StaticDrawer;
