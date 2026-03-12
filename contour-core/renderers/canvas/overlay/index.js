'use strict';

/**
 * contour-core Overlay System
 *
 * 架构说明：
 *
 * 核心组件:
 *   - Overlay: 纯数据容器（CRUD + 显示/隐藏状态）
 *   - CoordSystem: 坐标转换系统
 *   - EventEmitter: 事件发射器
 *
 * 服务层:
 *   - StaticDrawer: 静态绘制服务（添加/更新/删除元素）
 *   - InteractiveDrawer: 交互绘制服务（用户交互绘制）
 *   - OverlayRenderer: 渲染服务（绘制到 Canvas）
 *   - OverlayManager: 统一管理服务（显示/隐藏 + 定位 + 高亮 + 更新）
 *
 * 使用方式:
 *   var overlay = createOverlaySystem(renderer);
 *
 *   // 绘制
 *   overlay.drawPoint(10, 20, { color: 'red' });
 *   overlay.drawLine([...], { color: '#ff0000' });
 *
 *   // 管理
 *   overlay.manager.hide(id);
 *   overlay.manager.focusTo(id);
 *   overlay.manager.highlight(id);
 */

// 核心组件
var Overlay = require('./core/overlay');
var CoordSystem = require('./core/coord_system');
var EventEmitter = require('./core/event_emitter');

// 服务层
var StaticDrawer = require('./services/static_drawer');
var InteractiveDrawer = require('./services/interactive_drawer');
var OverlayRenderer = require('./services/renderer');
var OverlayManager = require('./services/overlay_manager');

/**
 * 创建覆盖物系统
 * @param {Object} renderer - 父渲染器（提供 drawingArea, fullRange, viewManager, refresh）
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

    var getViewManager = function() {
        if (!renderer) return null;
        if (renderer.getViewManager) return renderer.getViewManager();
        return null;
    };

    var overlayManager = new OverlayManager({
        overlay: overlay,
        staticDrawer: staticDrawer,
        coordSystem: coordSystem,
        viewManager: getViewManager,
        refresh: refresh
    });

    // ========================================
    // 3. 返回 API
    // ========================================

    return {
        // 核心组件访问（只读）
        overlay: overlay,
        coordSystem: coordSystem,
        manager: overlayManager,

        // ========================================
        // 绘制 API（委托给 StaticDrawer）
        // ========================================

        drawPoint: function(x, y, options) {
            return staticDrawer.drawPoint(x, y, options);
        },

        drawLine: function(points, options) {
            return staticDrawer.drawLine(points, options);
        },

        drawPolygon: function(points, options) {
            return staticDrawer.drawPolygon(points, options);
        },

        drawText: function(x, y, content, options) {
            return staticDrawer.drawText(x, y, content, options);
        },

        drawBatch: function(items) {
            return staticDrawer.drawBatch(items);
        },

        // ========================================
        // 交互绘制 API（委托给 InteractiveDrawer）
        // ========================================

        startDrawing: function(mode, options, canvas, onComplete) {
            return interactiveDrawer.start(mode, options, canvas, onComplete);
        },

        stopDrawing: function() {
            return interactiveDrawer.stop();
        },

        isDrawing: function() {
            return interactiveDrawer.isDrawing();
        },

        getDrawMode: function() {
            return interactiveDrawer.getMode();
        },

        getDrawState: function() {
            return interactiveDrawer.getState();
        },

        getTempPoints: function() {
            return interactiveDrawer.getTempPoints();
        },

        // ========================================
        // 数据操作 API（委托给 Overlay + StaticDrawer）
        // ========================================

        getItem: function(id) {
            return overlay.get(id);
        },

        getItemsByType: function(type) {
            return overlay.getByType(type);
        },

        getAllItems: function() {
            return overlay.getAll();
        },

        updateItem: function(id, data) {
            return staticDrawer.update(id, data);
        },

        removeItem: function(id) {
            return staticDrawer.remove(id);
        },

        clear: function(type) {
            overlay.clear(type);
            refresh();
        },

        count: function(type) {
            return overlay.count(type);
        },

        // ========================================
        // 管理 API（委托给 OverlayManager）
        // ========================================

        hide: function(id) {
            return overlayManager.hide(id);
        },

        show: function(id) {
            return overlayManager.show(id);
        },

        toggle: function(id) {
            return overlayManager.toggle(id);
        },

        isHidden: function(id) {
            return overlayManager.isHidden(id);
        },

        hideAll: function() {
            overlayManager.hideAll();
        },

        showAll: function() {
            overlayManager.showAll();
        },

        hideByType: function(type) {
            overlayManager.hideByType(type);
        },

        showByType: function(type) {
            overlayManager.showByType(type);
        },

        getVisibleItems: function() {
            return overlayManager.getVisibleItems();
        },

        getHiddenItems: function() {
            return overlayManager.getHiddenItems();
        },

        focusTo: function(id, options) {
            overlayManager.setViewManager(getViewManager);
            return overlayManager.focusTo(id, options);
        },

        focusToBounds: function(ids, options) {
            overlayManager.setViewManager(getViewManager);
            return overlayManager.focusToBounds(ids, options);
        },

        highlight: function(id, options) {
            return overlayManager.highlight(id, options);
        },

        clearHighlight: function(id) {
            return overlayManager.clearHighlight(id);
        },

        clearAllHighlights: function() {
            overlayManager.clearAllHighlights();
        },

        isHighlighted: function(id) {
            return overlayManager.isHighlighted(id);
        },

        getHighlightedIds: function() {
            return overlayManager.getHighlightedIds();
        },

        updateStyle: function(id, style) {
            return overlayManager.updateStyle(id, style);
        },

        updateData: function(id, data) {
            return overlayManager.updateData(id, data);
        },

        updateStyles: function(ids, style) {
            return overlayManager.updateStyles(ids, style);
        },

        updateDataList: function(dataList) {
            return overlayManager.updateDataList(dataList);
        },

        // ========================================
        // 渲染 API
        // ========================================

        render: function(ctx) {
            overlayRenderer.render(ctx, overlay, coordSystem.getDrawingArea());
            overlayRenderer.renderTemp(ctx, interactiveDrawer.getState(), coordSystem.getDrawingArea());
        },

        refresh: refresh,

        // ========================================
        // 坐标转换 API
        // ========================================

        dataToCanvas: function(x, y) {
            return coordSystem.toCanvas(x, y);
        },

        canvasToData: function(x, y) {
            return coordSystem.toData(x, y);
        },

        getScale: function() {
            return coordSystem.getScale();
        },

        isInBounds: function(x, y) {
            return coordSystem.isInBounds(x, y);
        },

        // ========================================
        // 事件订阅 API
        // ========================================

        on: function(event, handler) {
            return interactiveDrawer.on(event, handler);
        },

        off: function(event, handler) {
            return interactiveDrawer.off(event, handler);
        }
    };
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
module.exports.OverlayManager = OverlayManager;

// 底层渲染器（可独立使用）
module.exports.renderers = {
    line: require('./renderers/line'),
    point: require('./renderers/point'),
    polygon: require('./renderers/polygon'),
    text: require('./renderers/text'),
    shapes: require('./renderers/shapes'),
    patterns: require('./renderers/patterns')
};
