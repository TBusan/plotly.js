'use strict';

var EventEmitter = require('../core/event_emitter');

/**
 * InteractiveDrawer - 交互绘制服务
 *
 * ========================================
 * 设计原则
 * ========================================
 *
 * 1. 单一事件源：所有事件都通过 on/off 订阅
 * 2. 明确的生命周期：idle → drawing → completed → idle
 * 3. 状态驱动：状态转换时自动触发对应事件
 * 4. 事件数据规范化：每个事件都有明确的数据结构
 *
 * ========================================
 * 事件生命周期
 * ========================================
 *
 * 开始绘制：
 *   start(mode) → 状态变为 drawing → 触发 'draw:start' 事件
 *
 * 绘制过程：
 *   点击 → 触发 'draw:point' 事件（每个点）
 *   移动 → 触发 'draw:preview' 事件（预览）
 *
 * 完成绘制：
 *   完成 → 状态变为 completed → 触发 'draw:complete' 事件 → 状态变为 idle
 *   取消 → 状态变为 idle → 触发 'draw:cancel' 事件
 *
 * 手动停止：
 *   stop() → 状态变为 idle → 触发 'draw:stop' 事件
 *
 * ========================================
 * 事件列表
 * ========================================
 *
 * 'draw:start'   - 开始绘制 { mode: string }
 * 'draw:point'   - 添加点 { index: number, position: {x, y}, total: number }
 * 'draw:preview' - 预览更新 { mode, status, points, mousePos, options }
 * 'draw:complete'- 绘制完成 { type: string, id: string, ...data }
 * 'draw:cancel'  - 绘制取消 { reason: string, discardedPoints: [] }
 * 'draw:stop'    - 绘制停止 { reason: string }
 */
function InteractiveDrawer(config) {
    this._overlay = config.overlay;
    this._coordSystem = config.coordSystem;
    this._refresh = config.refresh || function() {};

    // 状态机
    this._status = Status.IDLE;
    this._mode = null;
    this._options = {};
    this._tempPoints = [];
    this._mousePos = null;
    this._canvas = null;

    // 事件系统
    this._events = new EventEmitter();

    // 事件绑定引用
    this._boundHandlers = {};
}

// ========================================
// 状态枚举
// ========================================
var Status = {
    IDLE: 'idle',
    DRAWING: 'drawing',
    COMPLETED: 'completed'
};

// ========================================
// 事件类型枚举
// ========================================
var Events = {
    START: 'draw:start',
    POINT: 'draw:point',
    PREVIEW: 'draw:preview',
    COMPLETE: 'draw:complete',
    CANCEL: 'draw:cancel',
    STOP: 'draw:stop'
};

InteractiveDrawer.prototype = {
    // ========================================
    // 生命周期
    // ========================================

    /**
     * 开始交互绘制
     * @param {string} mode - 绘制模式 ('point' | 'line' | 'polygon' | 'text')
     * @param {Object} options - 绘制选项
     * @param {HTMLCanvasElement} canvas - 画布元素
     */
    start: function(mode, options, canvas) {
        // 如果正在绘制，先停止
        if (this._status === Status.DRAWING) {
            this._transitionToIdle('restart');
        }

        // 初始化状态
        this._mode = mode;
        this._options = options || {};
        this._tempPoints = [];
        this._mousePos = null;
        this._canvas = canvas;

        // 状态转换：idle → drawing
        this._status = Status.DRAWING;

        // 绑定事件
        this._bindEvents();

        // 触发开始事件
        this._events.emit(Events.START, { mode: mode });
    },

    /**
     * 停止交互绘制
     */
    stop: function() {
        if (this._status === Status.IDLE) return;
        this._transitionToIdle('manual');
    },

    /**
     * 取消当前绘制
     */
    cancel: function() {
        if (this._status !== Status.DRAWING) return;

        var tempPoints = this._tempPoints.slice();
        this._transitionToIdle('cancel');

        this._events.emit(Events.CANCEL, {
            reason: 'user_cancel',
            discardedPoints: tempPoints
        });
    },

    // ========================================
    // 状态转换（私有）
    // ========================================

    /**
     * 转换到 idle 状态
     * @param {string} reason - 原因
     */
    _transitionToIdle: function(reason) {
        this._unbindEvents();
        this._status = Status.IDLE;
        this._mode = null;
        this._tempPoints = [];
        this._mousePos = null;
        this._canvas = null;

        this._events.emit(Events.STOP, { reason: reason });
        this._refresh();
    },

    /**
     * 完成绘制并转换状态
     * @param {Object} result - 绘制结果
     */
    _completeAndTransition: function(result) {
        // 先解绑事件，防止回调中再次触发
        this._unbindEvents();

        // 标记完成状态
        this._status = Status.COMPLETED;

        // 触发完成事件
        this._events.emit(Events.COMPLETE, result);

        // 转换到 idle
        this._status = Status.IDLE;
        this._mode = null;
        this._tempPoints = [];
        this._mousePos = null;
        this._canvas = null;

        this._events.emit(Events.STOP, { reason: 'completed' });
        this._refresh();
    },

    // ========================================
    // 状态查询
    // ========================================

    /**
     * 是否正在绘制
     * @returns {boolean}
     */
    isDrawing: function() {
        return this._status === Status.DRAWING;
    },

    /**
     * 获取当前模式
     * @returns {string|null}
     */
    getMode: function() {
        return this._mode;
    },

    /**
     * 获取当前状态
     * @returns {string}
     */
    getStatus: function() {
        return this._status;
    },

    /**
     * 获取绘制状态（用于渲染预览）
     * @returns {Object}
     */
    getState: function() {
        return {
            mode: this._mode,
            status: this._status,
            points: this._tempPoints.slice(),
            mousePos: this._mousePos ? { x: this._mousePos.x, y: this._mousePos.y } : null,
            options: Object.assign({}, this._options)
        };
    },

    /**
     * 获取临时点
     * @returns {Array}
     */
    getTempPoints: function() {
        return this._tempPoints.slice();
    },

    // ========================================
    // 事件订阅
    // ========================================

    /**
     * 订阅事件
     * @param {string} event - 事件名称
     * @param {Function} handler - 处理函数
     */
    on: function(event, handler) {
        this._events.on(event, handler);
        return this;
    },

    /**
     * 取消订阅
     * @param {string} event - 事件名称
     * @param {Function} handler - 处理函数
     */
    off: function(event, handler) {
        this._events.off(event, handler);
        return this;
    },

    /**
     * 订阅一次（自动取消）
     * @param {string} event - 事件名称
     * @param {Function} handler - 处理函数
     */
    once: function(event, handler) {
        var self = this;
        var wrapper = function(data) {
            self._events.off(event, wrapper);
            handler(data);
        };
        this._events.on(event, wrapper);
        return this;
    },

    // ========================================
    // 内部方法 - 事件绑定
    // ========================================

    _bindEvents: function() {
        if (!this._canvas) return;

        var self = this;

        this._boundHandlers = {
            click: function(e) { self._handleClick(e); },
            dblclick: function(e) { self._handleDblClick(e); },
            mousemove: function(e) { self._handleMouseMove(e); },
            keydown: function(e) { self._handleKeyDown(e); }
        };

        this._canvas.addEventListener('click', this._boundHandlers.click);
        this._canvas.addEventListener('dblclick', this._boundHandlers.dblclick);
        this._canvas.addEventListener('mousemove', this._boundHandlers.mousemove);
        document.addEventListener('keydown', this._boundHandlers.keydown);
    },

    _unbindEvents: function() {
        if (this._canvas) {
            this._canvas.removeEventListener('click', this._boundHandlers.click);
            this._canvas.removeEventListener('dblclick', this._boundHandlers.dblclick);
            this._canvas.removeEventListener('mousemove', this._boundHandlers.mousemove);
        }
        document.removeEventListener('keydown', this._boundHandlers.keydown);
        this._boundHandlers = {};
    },

    // ========================================
    // 内部方法 - 事件处理
    // ========================================

    _handleClick: function(e) {
        if (this._status !== Status.DRAWING) return;

        var pos = this._getCanvasPos(e);
        if (!this._coordSystem.isInBounds(pos.x, pos.y)) return;

        var dataPos = this._coordSystem.toData(pos.x, pos.y);
        if (!dataPos) return;

        switch (this._mode) {
            case 'point':
                this._handlePointComplete(dataPos);
                break;
            case 'line':
            case 'polygon':
                this._handlePointAdd(dataPos);
                break;
            case 'text':
                this._handleTextComplete(dataPos);
                break;
        }
    },

    _handleDblClick: function(e) {
        if (this._status !== Status.DRAWING) return;

        if (this._mode === 'line' || this._mode === 'polygon') {
            this._handleMultiPointComplete();
        }
    },

    _handleMouseMove: function(e) {
        if (this._status !== Status.DRAWING) return;
        if (this._mode !== 'line' && this._mode !== 'polygon') return;

        var pos = this._getCanvasPos(e);
        if (!this._coordSystem.isInBounds(pos.x, pos.y)) return;

        var dataPos = this._coordSystem.toData(pos.x, pos.y);
        if (!dataPos) return;

        this._mousePos = dataPos;

        this._events.emit(Events.PREVIEW, this.getState());
        this._refresh();
    },

    _handleKeyDown: function(e) {
        if (this._status !== Status.DRAWING) return;

        if (e.key === 'Escape') {
            this.cancel();
        } else if (e.key === 'Enter') {
            if (this._mode === 'line' || this._mode === 'polygon') {
                this._handleMultiPointComplete();
            }
        }
    },

    // ========================================
    // 内部方法 - 绘制处理
    // ========================================

    _handlePointAdd: function(dataPos) {
        this._tempPoints.push([dataPos.x, dataPos.y]);

        this._events.emit(Events.POINT, {
            index: this._tempPoints.length - 1,
            position: { x: dataPos.x, y: dataPos.y },
            total: this._tempPoints.length
        });

        this._refresh();
    },

    _handlePointComplete: function(dataPos) {
        var id = this._overlay.add('point', {
            x: dataPos.x,
            y: dataPos.y,
            options: this._options
        });

        this._completeAndTransition({
            type: 'point',
            id: id,
            position: { x: dataPos.x, y: dataPos.y }
        });
    },

    _handleTextComplete: function(dataPos) {
        var text = this._options.text || this._options.content || '';
        if (!text) {
            this.cancel();
            return;
        }

        var textOptions = Object.assign({}, this._options);
        delete textOptions.text;
        delete textOptions.content;

        var id = this._overlay.add('text', {
            x: dataPos.x,
            y: dataPos.y,
            content: text,
            options: textOptions
        });

        this._completeAndTransition({
            type: 'text',
            id: id,
            position: { x: dataPos.x, y: dataPos.y },
            content: text
        });
    },

    _handleMultiPointComplete: function() {
        var minPoints = this._mode === 'line' ? 2 : 3;

        if (this._tempPoints.length < minPoints) {
            this.cancel();
            return;
        }

        var id = this._overlay.add(this._mode, {
            points: this._tempPoints.slice(),
            options: this._options
        });

        this._completeAndTransition({
            type: this._mode,
            id: id,
            points: this._tempPoints.slice()
        });
    },

    _getCanvasPos: function(e) {
        var rect = this._canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
};

// ========================================
// 导出
// ========================================

module.exports = InteractiveDrawer;

// 导出枚举（方便外部使用）
module.exports.Status = Status;
module.exports.Events = Events;
