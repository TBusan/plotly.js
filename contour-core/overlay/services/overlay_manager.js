'use strict';

/**
 * OverlayManager - Overlay 统一管理服务
 *
 * 职责：
 *   - 显示/隐藏管理
 *   - 定位/聚焦管理
 *   - 高亮管理
 *   - 样式/数据更新管理
 *
 * 设计原则：
 *   - 单一入口管理所有 overlay 操作
 *   - 委托模式：具体操作委托给 Overlay（数据）和 StaticDrawer（绘制）
 */
function OverlayManager(config) {
    // 核心依赖
    this._overlay = config.overlay;           // 数据容器
    this._staticDrawer = config.staticDrawer; // 绘制服务
    this._coordSystem = config.coordSystem;   // 坐标系统
    this._viewManager = config.viewManager;   // 视图管理器（函数或对象）
    this._refresh = config.refresh || function() {};

    // 高亮状态存储
    this._highlights = new Map();  // id -> { originalColor, originalStrokeColor, ... }
}

OverlayManager.prototype = {
    // ========================================
    // 视图管理器引用更新
    // ========================================

    /**
     * 更新视图管理器引用
     * @param {Object|Function} viewManager - 视图管理器或获取函数
     */
    setViewManager: function(viewManager) {
        this._viewManager = viewManager;
    },

    /**
     * 获取视图管理器实例
     * @returns {Object|null}
     * @private
     */
    _getViewManager: function() {
        if (typeof this._viewManager === 'function') {
            return this._viewManager();
        }
        return this._viewManager;
    },

    // ========================================
    // 显示/隐藏管理
    // ========================================

    /**
     * 隐藏元素
     * @param {string} id - 元素ID
     * @returns {boolean} 是否成功
     */
    hide: function(id) {
        var result = this._overlay.hide(id);
        if (result) this._refresh();
        return result;
    },

    /**
     * 显示元素
     * @param {string} id - 元素ID
     * @returns {boolean} 是否成功
     */
    show: function(id) {
        var result = this._overlay.show(id);
        if (result) this._refresh();
        return result;
    },

    /**
     * 切换元素显示/隐藏
     * @param {string} id - 元素ID
     * @returns {boolean} 切换后的状态 (true=隐藏)
     */
    toggle: function(id) {
        var result = this._overlay.toggle(id);
        this._refresh();
        return result;
    },

    /**
     * 检查元素是否隐藏
     * @param {string} id - 元素ID
     * @returns {boolean}
     */
    isHidden: function(id) {
        return this._overlay.isHidden(id);
    },

    /**
     * 隐藏所有元素
     */
    hideAll: function() {
        this._overlay.hideAll();
        this._refresh();
    },

    /**
     * 显示所有元素
     */
    showAll: function() {
        this._overlay.showAll();
        this._refresh();
    },

    /**
     * 隐藏某类型的所有元素
     * @param {string} type - 元素类型
     */
    hideByType: function(type) {
        this._overlay.hideByType(type);
        this._refresh();
    },

    /**
     * 显示某类型的所有元素
     * @param {string} type - 元素类型
     */
    showByType: function(type) {
        this._overlay.showByType(type);
        this._refresh();
    },

    /**
     * 获取所有可见元素
     * @returns {Array}
     */
    getVisibleItems: function() {
        return this._overlay.getVisible();
    },

    /**
     * 获取所有隐藏元素
     * @returns {Array}
     */
    getHiddenItems: function() {
        return this._overlay.getHidden();
    },

    // ========================================
    // 定位/聚焦管理
    // ========================================

    /**
     * 聚焦到指定元素（调整视图使元素可见）
     * @param {string} id - 元素ID
     * @param {Object} options - 选项
     * @param {number} options.padding - 边距（像素），默认 50
     * @returns {boolean} 是否成功
     */
    focusTo: function(id, options) {
        var item = this._overlay.get(id);
        if (!item) return false;

        options = options || {};
        var bounds = this._calculateFocusBounds([item], options.padding || 50);
        if (!bounds) return false;

        return this._applyFocusBounds(bounds);
    },

    /**
     * 聚焦到多个元素（调整视图使所有元素可见）
     * @param {Array} ids - 元素ID数组
     * @param {Object} options - 选项
     * @returns {boolean} 是否成功
     */
    focusToBounds: function(ids, options) {
        if (!Array.isArray(ids) || ids.length === 0) return false;

        options = options || {};
        var items = [];
        for (var i = 0; i < ids.length; i++) {
            var item = this._overlay.get(ids[i]);
            if (item) items.push(item);
        }

        if (items.length === 0) return false;

        var bounds = this._calculateFocusBounds(items, options.padding || 50);
        if (!bounds) return false;

        return this._applyFocusBounds(bounds);
    },

    /**
     * 计算聚焦边界
     * @param {Array} items - 元素数组
     * @param {number} padding - 边距
     * @returns {Object|null}
     * @private
     */
    _calculateFocusBounds: function(items, padding) {
        if (!items || items.length === 0) return null;

        // 计算所有元素的边界
        var bounds = {
            xMin: Infinity,
            xMax: -Infinity,
            yMin: Infinity,
            yMax: -Infinity
        };

        for (var i = 0; i < items.length; i++) {
            var itemBounds = this._getItemBounds(items[i]);
            if (itemBounds) {
                bounds.xMin = Math.min(bounds.xMin, itemBounds.xMin);
                bounds.xMax = Math.max(bounds.xMax, itemBounds.xMax);
                bounds.yMin = Math.min(bounds.yMin, itemBounds.yMin);
                bounds.yMax = Math.max(bounds.yMax, itemBounds.yMax);
            }
        }

        if (!isFinite(bounds.xMin)) return null;

        // 获取绘制区域
        var drawingArea = this._coordSystem.getDrawingArea();
        if (!drawingArea) return null;

        // 计算范围
        var xRange = bounds.xMax - bounds.xMin;
        var yRange = bounds.yMax - bounds.yMin;

        // 避免范围为0
        if (xRange === 0) { xRange = 1; bounds.xMin -= 0.5; bounds.xMax += 0.5; }
        if (yRange === 0) { yRange = 1; bounds.yMin -= 0.5; bounds.yMax += 0.5; }

        // 根据 padding 计算扩展
        var paddingRatioX = padding / drawingArea.width;
        var paddingRatioY = padding / drawingArea.height;

        return {
            xMin: bounds.xMin - xRange * paddingRatioX,
            xMax: bounds.xMax + xRange * paddingRatioX,
            yMin: bounds.yMin - yRange * paddingRatioY,
            yMax: bounds.yMax + yRange * paddingRatioY
        };
    },

    /**
     * 应用聚焦边界
     * @param {Object} bounds - 边界
     * @returns {boolean}
     * @private
     */
    _applyFocusBounds: function(bounds) {
        var viewManager = this._getViewManager();
        if (viewManager && viewManager.setRange) {
            viewManager.setRange(bounds.xMin, bounds.xMax, bounds.yMin, bounds.yMax);
        }
        this._refresh();
        return true;
    },

    // ========================================
    // 高亮管理
    // ========================================

    /**
     * 高亮元素
     * @param {string} id - 元素ID
     * @param {Object} options - 选项
     * @param {string} options.color - 高亮颜色，默认 '#ff0000'
     * @param {number} options.duration - 持续时间(ms)，0 表示持续，默认 0
     * @param {number} options.lineWidth - 高亮时的线宽（线/多边形）
     * @param {number} options.size - 高亮时的大小（点）
     * @returns {boolean} 是否成功
     */
    highlight: function(id, options) {
        var item = this._overlay.get(id);
        if (!item) return false;

        options = options || {};

        // 保存原始样式（支持扁平格式和嵌套格式）
        var originalStyle = this._saveOriginalStyle(item);
        this._highlights.set(id, originalStyle);

        // 应用高亮样式
        this._applyHighlightStyle(item, options);

        this._refresh();

        // 自动取消高亮
        if (options.duration && options.duration > 0) {
            var self = this;
            setTimeout(function() {
                self.clearHighlight(id);
            }, options.duration);
        }

        return true;
    },

    /**
     * 保存元素的原始样式（支持扁平格式和嵌套格式）
     * @param {Object} item - 元素对象
     * @returns {Object} 原始样式
     * @private
     */
    _saveOriginalStyle: function(item) {
        var opts = item.options || {};
        var style = {
            // 扁平格式
            color: opts.color,
            fillColor: opts.fillColor,
            strokeColor: opts.strokeColor,
            strokeWidth: opts.strokeWidth,
            width: opts.width,
            lineWidth: opts.lineWidth,
            size: opts.size,
            // 嵌套格式（polygon）
            fill: opts.fill ? this._cloneObject(opts.fill) : undefined,
            stroke: opts.stroke ? this._cloneObject(opts.stroke) : undefined
        };
        return style;
    },

    /**
     * 应用高亮样式（支持扁平格式和嵌套格式）
     * @param {Object} item - 元素对象
     * @param {Object} options - 高亮选项
     * @private
     */
    _applyHighlightStyle: function(item, options) {
        if (!item.options) return;

        var highlightColor = options.color || '#ff0000';

        if (item.type === 'polygon') {
            // 多边形：同时更新扁平格式和嵌套格式
            // 扁平格式
            if (item.options.color !== undefined || item.options.fillColor !== undefined) {
                item.options.color = highlightColor;
                item.options.fillColor = highlightColor;
            }
            // 嵌套格式
            if (item.options.fill && item.options.fill.color) {
                item.options.fill = {
                    type: item.options.fill.type || 'color',
                    color: highlightColor
                };
            }
            // 边框
            if (!options.strokeColor) {
                item.options.strokeColor = highlightColor;
                if (item.options.stroke) {
                    item.options.stroke = this._cloneObject(item.options.stroke);
                    item.options.stroke.color = highlightColor;
                }
            }
            if (options.lineWidth !== undefined) {
                item.options.strokeWidth = options.lineWidth;
                item.options.lineWidth = options.lineWidth;
                if (item.options.stroke) {
                    item.options.stroke = item.options.stroke || {};
                    item.options.stroke.width = options.lineWidth;
                }
            }
        } else if (item.type === 'line') {
            item.options.color = highlightColor;
            if (options.lineWidth !== undefined) {
                item.options.lineWidth = options.lineWidth;
                item.options.width = options.lineWidth;
            }
        } else if (item.type === 'point') {
            item.options.color = highlightColor;
            if (options.size !== undefined) {
                item.options.size = options.size;
            }
        } else if (item.type === 'text') {
            item.options.color = highlightColor;
        }

        // 覆盖：如果明确指定了 strokeColor
        if (options.strokeColor) {
            item.options.strokeColor = options.strokeColor;
        }
    },

    /**
     * 克隆对象（浅拷贝）
     * @param {Object} obj - 要克隆的对象
     * @returns {Object} 克隆后的对象
     * @private
     */
    _cloneObject: function(obj) {
        if (!obj) return obj;
        var clone = {};
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                clone[key] = obj[key];
            }
        }
        return clone;
    },

    /**
     * 取消高亮
     * @param {string} id - 元素ID
     * @returns {boolean} 是否成功
     */
    clearHighlight: function(id) {
        var originalStyle = this._highlights.get(id);
        if (!originalStyle) return false;

        var item = this._overlay.get(id);
        if (item && item.options) {
            // 恢复原始样式（支持扁平格式和嵌套格式）
            this._restoreOriginalStyle(item, originalStyle);
        }

        this._highlights.delete(id);
        this._refresh();
        return true;
    },

    /**
     * 恢复元素的原始样式（支持扁平格式和嵌套格式）
     * @param {Object} item - 元素对象
     * @param {Object} originalStyle - 原始样式
     * @private
     */
    _restoreOriginalStyle: function(item, originalStyle) {
        var opts = item.options;
        if (!opts) return;

        // 恢复扁平格式属性
        if (originalStyle.color !== undefined) {
            opts.color = originalStyle.color;
        } else {
            delete opts.color;
        }
        if (originalStyle.fillColor !== undefined) {
            opts.fillColor = originalStyle.fillColor;
        } else {
            delete opts.fillColor;
        }
        if (originalStyle.strokeColor !== undefined) {
            opts.strokeColor = originalStyle.strokeColor;
        } else {
            delete opts.strokeColor;
        }
        if (originalStyle.strokeWidth !== undefined) {
            opts.strokeWidth = originalStyle.strokeWidth;
        } else {
            delete opts.strokeWidth;
        }
        if (originalStyle.width !== undefined) {
            opts.width = originalStyle.width;
        }
        if (originalStyle.lineWidth !== undefined) {
            opts.lineWidth = originalStyle.lineWidth;
        }
        if (originalStyle.size !== undefined) {
            opts.size = originalStyle.size;
        }

        // 恢复嵌套格式属性（polygon）
        if (originalStyle.fill !== undefined) {
            opts.fill = originalStyle.fill ? this._cloneObject(originalStyle.fill) : undefined;
        }
        if (originalStyle.stroke !== undefined) {
            opts.stroke = originalStyle.stroke ? this._cloneObject(originalStyle.stroke) : undefined;
        }
    },

    /**
     * 取消所有高亮
     */
    clearAllHighlights: function() {
        var self = this;
        var ids = Array.from(this._highlights.keys());
        ids.forEach(function(id) {
            self.clearHighlight(id);
        });
    },

    /**
     * 检查元素是否处于高亮状态
     * @param {string} id - 元素ID
     * @returns {boolean}
     */
    isHighlighted: function(id) {
        return this._highlights.has(id);
    },

    /**
     * 获取所有高亮的元素ID
     * @returns {Array}
     */
    getHighlightedIds: function() {
        return Array.from(this._highlights.keys());
    },

    // ========================================
    // 样式/数据更新管理
    // ========================================

    /**
     * 只更新样式（不影响数据）
     * @param {string} id - 元素ID
     * @param {Object} style - 样式对象
     * @returns {Object|null} 更新后的元素
     */
    updateStyle: function(id, style) {
        return this._staticDrawer.updateStyle(id, style);
    },

    /**
     * 只更新数据（不影响样式）
     * @param {string} id - 元素ID
     * @param {Object} data - 数据对象
     * @returns {Object|null} 更新后的元素
     */
    updateData: function(id, data) {
        return this._staticDrawer.updateData(id, data);
    },

    /**
     * 批量更新样式
     * @param {Array} ids - 元素ID数组
     * @param {Object} style - 样式对象
     * @returns {Array} 更新成功的元素数组
     */
    updateStyles: function(ids, style) {
        return this._staticDrawer.updateStyles(ids, style);
    },

    /**
     * 批量更新数据
     * @param {Array} dataList - 数据列表 [{id, ...data}]
     * @returns {Array} 更新成功的元素数组
     */
    updateDataList: function(dataList) {
        return this._staticDrawer.updateDataList(dataList);
    },

    // ========================================
    // 内部工具方法
    // ========================================

    /**
     * 获取元素的边界
     * @param {Object} item - 元素对象
     * @returns {Object|null} { xMin, xMax, yMin, yMax }
     * @private
     */
    _getItemBounds: function(item) {
        if (!item) return null;

        var bounds = {
            xMin: Infinity,
            xMax: -Infinity,
            yMin: Infinity,
            yMax: -Infinity
        };

        switch (item.type) {
            case 'point':
            case 'text':
                if (typeof item.x === 'number' && typeof item.y === 'number') {
                    bounds.xMin = bounds.xMax = item.x;
                    bounds.yMin = bounds.yMax = item.y;
                }
                break;

            case 'line':
            case 'polygon':
                if (Array.isArray(item.points)) {
                    for (var i = 0; i < item.points.length; i++) {
                        var p = item.points[i];
                        if (p && typeof p.x === 'number' && typeof p.y === 'number') {
                            bounds.xMin = Math.min(bounds.xMin, p.x);
                            bounds.xMax = Math.max(bounds.xMax, p.x);
                            bounds.yMin = Math.min(bounds.yMin, p.y);
                            bounds.yMax = Math.max(bounds.yMax, p.y);
                        }
                    }
                }
                break;
        }

        if (!isFinite(bounds.xMin)) return null;
        return bounds;
    }
};

module.exports = OverlayManager;
