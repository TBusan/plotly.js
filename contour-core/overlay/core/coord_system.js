'use strict';

/**
 * CoordSystem - 坐标转换系统
 * 纯函数式设计，无副作用
 */
function CoordSystem(getDrawingArea, getVisibleRange) {
    this._getDrawingArea = getDrawingArea;
    this._getVisibleRange = getVisibleRange;
}

CoordSystem.prototype = {
    /**
     * 数据坐标 → 画布坐标
     * @param {number} x - 数据 X 坐标
     * @param {number} y - 数据 Y 坐标
     * @returns {Object} 画布坐标 {x, y}
     */
    toCanvas: function(x, y) {
        // 验证输入
        if (!this._isValidNumber(x) || !this._isValidNumber(y)) {
            return null;
        }

        var area = this._getDrawingArea();
        var range = this._getVisibleRange();

        if (!area || !range) {
            return { x: x, y: y };
        }

        // 防止除以零
        var xRange = range.xMax - range.xMin;
        var yRange = range.yMax - range.yMin;
        var xScale = xRange !== 0 ? area.width / xRange : 1;
        var yScale = yRange !== 0 ? area.height / yRange : 1;

        return {
            x: area.x + (x - range.xMin) * xScale,
            y: area.y + area.height - (y - range.yMin) * yScale
        };
    },

    /**
     * 画布坐标 → 数据坐标
     * @param {number} canvasX - 画布 X 坐标
     * @param {number} canvasY - 画布 Y 坐标
     * @returns {Object} 数据坐标 {x, y}
     */
    toData: function(canvasX, canvasY) {
        if (!this._isValidNumber(canvasX) || !this._isValidNumber(canvasY)) {
            return null;
        }

        var area = this._getDrawingArea();
        var range = this._getVisibleRange();

        if (!area || !range) {
            return { x: canvasX, y: canvasY };
        }

        var xRange = range.xMax - range.xMin;
        var yRange = range.yMax - range.yMin;
        var xScale = xRange !== 0 ? area.width / xRange : 1;
        var yScale = yRange !== 0 ? area.height / yRange : 1;

        return {
            x: range.xMin + (canvasX - area.x) / xScale,
            y: range.yMin + (area.y + area.height - canvasY) / yScale
        };
    },

    /**
     * 批量转换到画布坐标
     * @param {Array} points - 点数组 [{x, y} 或 [x, y]]
     * @returns {Array} 画布坐标数组
     */
    toCanvasBatch: function(points) {
        var self = this;
        return points.map(function(p) {
            var x = p.x !== undefined ? p.x : p[0];
            var y = p.y !== undefined ? p.y : p[1];
            return self.toCanvas(x, y);
        }).filter(function(p) {
            return p !== null;
        });
    },

    /**
     * 检查是否在绘制区域内
     * @param {number} canvasX - 画布 X 坐标
     * @param {number} canvasY - 画布 Y 坐标
     * @returns {boolean} 是否在区域内
     */
    isInBounds: function(canvasX, canvasY) {
        var area = this._getDrawingArea();
        if (!area) return true;

        return canvasX >= area.x &&
               canvasX <= area.x + area.width &&
               canvasY >= area.y &&
               canvasY <= area.y + area.height;
    },

    /**
     * 获取当前缩放比例
     * @returns {Object} 缩放比例 {x, y}
     */
    getScale: function() {
        var area = this._getDrawingArea();
        var range = this._getVisibleRange();

        if (!area || !range) {
            return { x: 1, y: 1 };
        }

        var xRange = range.xMax - range.xMin;
        var yRange = range.yMax - range.yMin;

        return {
            x: xRange !== 0 ? area.width / xRange : 1,
            y: yRange !== 0 ? area.height / yRange : 1
        };
    },

    /**
     * 获取绘制区域
     * @returns {Object} 绘制区域
     */
    getDrawingArea: function() {
        return this._getDrawingArea();
    },

    /**
     * 获取可见范围
     * @returns {Object} 可见范围
     */
    getVisibleRange: function() {
        return this._getVisibleRange();
    },

    // ========================================
    // 内部方法
    // ========================================

    _isValidNumber: function(value) {
        return typeof value === 'number' && isFinite(value) && !isNaN(value);
    }
};

module.exports = CoordSystem;
