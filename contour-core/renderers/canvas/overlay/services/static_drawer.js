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
     * @returns {string} 元素ID
     */
    drawPoint: function(x, y, options) {
        var id = this._overlay.add('point', {
            x: x,
            y: y,
            options: options || {}
        });
        this._refresh();
        return id;
    },

    /**
     * 绘制线
     * @param {Array} points - 点数组 [{x, y} 或 [x, y]]
     * @param {Object} options - 线选项
     * @returns {string} 元素ID
     */
    drawLine: function(points, options) {
        var id = this._overlay.add('line', {
            points: this._normalizePoints(points),
            options: options || {}
        });
        this._refresh();
        return id;
    },

    /**
     * 绘制多边形
     * @param {Array} points - 点数组 [{x, y} 或 [x, y]]
     * @param {Object} options - 多边形选项
     * @returns {string} 元素ID
     */
    drawPolygon: function(points, options) {
        var id = this._overlay.add('polygon', {
            points: this._normalizePoints(points),
            options: options || {}
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
     * @returns {string} 元素ID
     */
    drawText: function(x, y, content, options) {
        var id = this._overlay.add('text', {
            x: x,
            y: y,
            content: content,
            options: options || {}
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
