'use strict';

/**
 * contour-core Overlay System
 *
 * 完全解耦的覆盖物系统架构：
 *
 * 核心组件:
 *   - Overlay: 纯数据容器
 *   - CoordSystem: 坐标转换系统
 *   - EventEmitter: 事件发射器
 *
 * 服务层:
 *   - StaticDrawer: 静态绘制服务
 *   - InteractiveDrawer: 交互绘制服务
 *   - OverlayRenderer: 渲染服务
 *
 * 使用方式:
 *   var overlaySystem = createOverlaySystem(renderer);
 *   overlaySystem.drawLine([...], { color: '#ff0000' });
 *   overlaySystem.startDrawing('polygon', options, canvas, callback);
 */

// 核心组件
var Overlay = require('./core/overlay');
var CoordSystem = require('./core/coord_system');
var EventEmitter = require('./core/event_emitter');

// 服务层
var StaticDrawer = require('./services/static_drawer');
var InteractiveDrawer = require('./services/interactive_drawer');
var OverlayRenderer = require('./services/renderer');

/**
 * 创建完整的覆盖物系统
 * @param {Object} renderer - 父渲染器（提供 drawingArea, fullRange, viewManager）
 * @returns {Object} 覆盖物系统 API
 */
function createOverlaySystem(renderer) {
    // ========================================
    // 1. 创建核心组件
    // ========================================

    var overlay = new Overlay();

    var coordSystem = new CoordSystem(
        function getDrawingArea() {
            if (!renderer) return null;
            return typeof renderer._drawingArea === 'function'
                ? renderer._drawingArea()
                : renderer._drawingArea;
        },
        function getVisibleRange() {
            if (!renderer) return null;
            if (renderer.getViewManager) {
                var vm = renderer.getViewManager();
                if (vm && vm.getState) return vm.getState();
            }
            return typeof renderer._fullRange === 'function'
                ? renderer._fullRange()
                : renderer._fullRange;
        }
    );

    var overlayRenderer = new OverlayRenderer(coordSystem);

    var refresh = function() {
        if (renderer && typeof renderer.refresh === 'function') {
            renderer.refresh();
        }
    };

    // ========================================
    // 2. 创建服务
    // ========================================

    var staticDrawer = new StaticDrawer(overlay, refresh);

    var interactiveDrawer = new InteractiveDrawer({
        overlay: overlay,
        coordSystem: coordSystem,
        refresh: refresh
    });

    // ========================================
    // 3. 返回组合后的 API
    // ========================================

    var system = {
        // ========================================
        // 数据容器访问（只读）
        // ========================================
        overlay: overlay,
        coordSystem: coordSystem,

        // ========================================
        // 静态绘制 API
        // ========================================

        /**
         * 绘制点
         * @param {number} x - X 坐标（数据坐标）
         * @param {number} y - Y 坐标（数据坐标）
         * @param {Object} options - 点选项
         * @returns {string} 元素ID
         */
        drawPoint: function(x, y, options) {
            return staticDrawer.drawPoint(x, y, options);
        },

        /**
         * 绘制线
         * @param {Array} points - 点数组 [{x, y} 或 [x, y]]
         * @param {Object} options - 线选项
         * @returns {string} 元素ID
         */
        drawLine: function(points, options) {
            return staticDrawer.drawLine(points, options);
        },

        /**
         * 绘制多边形
         * @param {Array} points - 点数组 [{x, y} 或 [x, y]]
         * @param {Object} options - 多边形选项
         * @returns {string} 元素ID
         */
        drawPolygon: function(points, options) {
            return staticDrawer.drawPolygon(points, options);
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
            return staticDrawer.drawText(x, y, content, options);
        },

        /**
         * 批量绘制
         * @param {Array} items - 元素数组 [{type, data}]
         * @returns {Array} 元素ID数组
         */
        drawBatch: function(items) {
            return staticDrawer.drawBatch(items);
        },

        // ========================================
        // 交互绘制 API
        // ========================================

        /**
         * 开始交互绘制
         * @param {string} mode - 绘制模式 ('point', 'line', 'polygon', 'text')
         * @param {Object} options - 绘制选项
         * @param {HTMLCanvasElement} canvas - 画布元素
         * @param {Function} onComplete - 完成回调
         */
        startDrawing: function(mode, options, canvas, onComplete) {
            return interactiveDrawer.start(mode, options, canvas, onComplete);
        },

        /**
         * 停止交互绘制
         */
        stopDrawing: function() {
            return interactiveDrawer.stop();
        },

        /**
         * 是否正在绘制
         * @returns {boolean}
         */
        isDrawing: function() {
            return interactiveDrawer.isDrawing();
        },

        /**
         * 获取当前绘制模式
         * @returns {string|null}
         */
        getDrawMode: function() {
            return interactiveDrawer.getMode();
        },

        /**
         * 获取绘制状态（用于渲染预览）
         * @returns {Object}
         */
        getDrawState: function() {
            return interactiveDrawer.getState();
        },

        /**
         * 获取临时点
         * @returns {Array}
         */
        getTempPoints: function() {
            return interactiveDrawer.getTempPoints();
        },

        // ========================================
        // 数据操作 API
        // ========================================

        /**
         * 获取单个元素
         * @param {string} id - 元素ID
         * @returns {Object|null}
         */
        getItem: function(id) {
            return overlay.get(id);
        },

        /**
         * 获取某类型的所有元素
         * @param {string} type - 元素类型
         * @returns {Array}
         */
        getItemsByType: function(type) {
            return overlay.getByType(type);
        },

        /**
         * 获取所有元素
         * @returns {Array}
         */
        getAllItems: function() {
            return overlay.getAll();
        },

        /**
         * 更新元素
         * @param {string} id - 元素ID
         * @param {Object} data - 更新数据
         * @returns {Object|null}
         */
        updateItem: function(id, data) {
            return staticDrawer.update(id, data);
        },

        /**
         * 删除元素
         * @param {string} id - 元素ID
         * @returns {boolean}
         */
        removeItem: function(id) {
            return staticDrawer.remove(id);
        },

        /**
         * 清空元素
         * @param {string} [type] - 元素类型，不传则清空所有
         */
        clear: function(type) {
            overlay.clear(type);
            refresh();
        },

        /**
         * 获取元素数量
         * @param {string} [type] - 元素类型
         * @returns {number}
         */
        count: function(type) {
            return overlay.count(type);
        },

        // ========================================
        // 渲染 API
        // ========================================

        /**
         * 渲染所有覆盖物
         * @param {CanvasRenderingContext2D} ctx - 画布上下文
         */
        render: function(ctx) {
            overlayRenderer.render(ctx, overlay, coordSystem.getDrawingArea());
            overlayRenderer.renderTemp(ctx, interactiveDrawer.getState(), coordSystem.getDrawingArea());
        },

        /**
         * 刷新（触发父渲染器重绘）
         */
        refresh: refresh,

        // ========================================
        // 坐标转换 API
        // ========================================

        /**
         * 数据坐标 → 画布坐标
         * @param {number} x - 数据 X 坐标
         * @param {number} y - 数据 Y 坐标
         * @returns {Object|null}
         */
        dataToCanvas: function(x, y) {
            return coordSystem.toCanvas(x, y);
        },

        /**
         * 画布坐标 → 数据坐标
         * @param {number} x - 画布 X 坐标
         * @param {number} y - 画布 Y 坐标
         * @returns {Object|null}
         */
        canvasToData: function(x, y) {
            return coordSystem.toData(x, y);
        },

        /**
         * 获取缩放比例
         * @returns {Object}
         */
        getScale: function() {
            return coordSystem.getScale();
        },

        /**
         * 检查是否在绘制区域内
         * @param {number} x - 画布 X 坐标
         * @param {number} y - 画布 Y 坐标
         * @returns {boolean}
         */
        isInBounds: function(x, y) {
            return coordSystem.isInBounds(x, y);
        },

        // ========================================
        // 事件订阅 API
        // ========================================

        /**
         * 订阅绘制事件
         * @param {string} event - 事件名称
         * @param {Function} handler - 处理函数
         */
        on: function(event, handler) {
            return interactiveDrawer.on(event, handler);
        },

        /**
         * 取消订阅
         * @param {string} event - 事件名称
         * @param {Function} handler - 处理函数
         */
        off: function(event, handler) {
            return interactiveDrawer.off(event, handler);
        }
    };

    return system;
}

// ========================================
// 导出
// ========================================

// 工厂函数
module.exports = createOverlaySystem;

// 核心组件（可独立使用）
module.exports.Overlay = Overlay;
module.exports.CoordSystem = CoordSystem;
module.exports.EventEmitter = EventEmitter;

// 服务层（可独立使用）
module.exports.StaticDrawer = StaticDrawer;
module.exports.InteractiveDrawer = InteractiveDrawer;
module.exports.OverlayRenderer = OverlayRenderer;

// 底层渲染器（可独立使用）
module.exports.renderers = {
    line: require('./renderers/line'),
    point: require('./renderers/point'),
    polygon: require('./renderers/polygon'),
    text: require('./renderers/text'),
    shapes: require('./renderers/shapes'),
    patterns: require('./renderers/patterns')
};
