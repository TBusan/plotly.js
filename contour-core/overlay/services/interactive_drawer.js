'use strict';

var EventEmitter = require('../core/event_emitter');

/**
 * InteractiveDrawer - 交互绘制服务
 * 职责：管理交互绘制流程，响应用户输入
 *
 * 设计模式：状态机 + 观察者
 */
function InteractiveDrawer(config) {
    this._overlay = config.overlay;
    this._coordSystem = config.coordSystem;
    this._refresh = config.refresh || function() {};

    // 状态机
    this._state = {
        mode: null,           // 'point' | 'line' | 'polygon' | 'text' | null
        status: 'idle',       // 'idle' | 'drawing' | 'completed'
        tempPoints: [],
        options: {},
        mousePos: null
    };

    // 事件系统
    this._events = new EventEmitter();

    // 事件绑定状态
    this._canvas = null;
    this._boundHandlers = {};
}

InteractiveDrawer.prototype = {
    // ========================================
    // 生命周期
    // ========================================

    /**
     * 开始交互绘制
     * @param {string} mode - 绘制模式
     * @param {Object} options - 绘制选项
     * @param {HTMLCanvasElement} canvas - 画布元素
     * @param {Function} onComplete - 完成回调
     */
    start: function(mode, options, canvas, onComplete) {
        // 停止之前的绘制
        this.stop();

        // 清理之前的 complete 回调，防止重复执行
        this._events.off('complete');

        // 初始化状态
        this._state.mode = mode;
        this._state.status = 'drawing';
        this._state.options = options || {};
        this._state.tempPoints = [];
        this._state.mousePos = null;
        this._canvas = canvas;

        // 注册完成回调
        if (onComplete) {
            this._events.once('complete', onComplete);
        }

        // 绑定事件
        this._bindEvents();

        this._events.emit('start', { mode: mode });
    },

    /**
     * 停止交互绘制
     */
    stop: function() {
        this._unbindEvents();
        this._state.mode = null;
        this._state.status = 'idle';
        this._state.tempPoints = [];
        this._state.mousePos = null;
        this._canvas = null;
        this._events.emit('stop');
    },

    // ========================================
    // 状态查询
    // ========================================

    /**
     * 获取当前绘制状态（用于渲染预览）
     * @returns {Object} 状态对象
     */
    getState: function() {
        return {
            mode: this._state.mode,
            status: this._state.status,
            points: this._state.tempPoints.slice(),
            mousePos: this._state.mousePos ? {
                x: this._state.mousePos.x,
                y: this._state.mousePos.y
            } : null,
            options: Object.assign({}, this._state.options)
        };
    },

    /**
     * 是否正在绘制
     * @returns {boolean}
     */
    isDrawing: function() {
        return this._state.status === 'drawing';
    },

    /**
     * 获取当前模式
     * @returns {string|null}
     */
    getMode: function() {
        return this._state.mode;
    },

    /**
     * 获取临时点
     * @returns {Array}
     */
    getTempPoints: function() {
        return this._state.tempPoints.slice();
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

    // ========================================
    // 内部方法 - 事件处理
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

    _handleClick: function(e) {
        var pos = this._getCanvasPos(e);
        if (!this._coordSystem.isInBounds(pos.x, pos.y)) return;

        var dataPos = this._coordSystem.toData(pos.x, pos.y);
        if (!dataPos) return;

        switch (this._state.mode) {
            case 'point':
                this._completePoint(dataPos);
                break;
            case 'line':
            case 'polygon':
                this._addTempPoint(dataPos);
                break;
            case 'text':
                this._completeText(dataPos);
                break;
        }
    },

    _handleDblClick: function(e) {
        if (this._state.mode === 'line' || this._state.mode === 'polygon') {
            this._completeMultiPoint();
        }
    },

    _handleMouseMove: function(e) {
        if (!this.isDrawing()) return;
        if (this._state.mode !== 'line' && this._state.mode !== 'polygon') return;

        var pos = this._getCanvasPos(e);
        if (!this._coordSystem.isInBounds(pos.x, pos.y)) return;

        var dataPos = this._coordSystem.toData(pos.x, pos.y);
        if (!dataPos) return;

        this._state.mousePos = dataPos;

        this._events.emit('preview', this.getState());
        this._refresh();
    },

    _handleKeyDown: function(e) {
        if (e.key === 'Escape') {
            this.stop();
            this._refresh();
        } else if (e.key === 'Enter') {
            if (this._state.mode === 'line' || this._state.mode === 'polygon') {
                this._completeMultiPoint();
            }
        }
    },

    // ========================================
    // 内部方法 - 状态转换
    // ========================================

    _addTempPoint: function(dataPos) {
        this._state.tempPoints.push([dataPos.x, dataPos.y]);
        this._events.emit('point', {
            index: this._state.tempPoints.length - 1,
            position: dataPos
        });
        this._refresh();
    },

    _completePoint: function(dataPos) {
        var id = this._overlay.add('point', {
            x: dataPos.x,
            y: dataPos.y,
            options: this._state.options
        });

        var result = {
            type: 'point',
            id: id,
            x: dataPos.x,
            y: dataPos.y
        };

        // 先调用 stop() 清理状态，再触发 complete 事件
        this._state.status = 'completed';
        this.stop();
        this._events.emit('complete', result);
        this._refresh();
    },

    _completeText: function(dataPos) {
        var text = this._state.options.text || this._state.options.content || '';
        if (!text) {
            this.stop();
            return;
        }

        var textOptions = Object.assign({}, this._state.options);
        delete textOptions.text;
        delete textOptions.content;

        var id = this._overlay.add('text', {
            x: dataPos.x,
            y: dataPos.y,
            content: text,
            options: textOptions
        });

        var result = {
            type: 'text',
            id: id,
            x: dataPos.x,
            y: dataPos.y,
            content: text
        };

        // 先调用 stop() 清理状态，再触发 complete 事件
        this._state.status = 'completed';
        this.stop();
        this._events.emit('complete', result);
        this._refresh();
    },

    _completeMultiPoint: function() {
        if (this._state.tempPoints.length < 2) {
            this.stop();
            return;
        }

        var type = this._state.mode;
        var id;
        var result;

        if (type === 'line') {
            id = this._overlay.add('line', {
                points: this._state.tempPoints.slice(),
                options: this._state.options
            });

            result = {
                type: 'line',
                id: id,
                points: this._state.tempPoints.slice()
            };
        } else if (type === 'polygon' && this._state.tempPoints.length >= 3) {
            id = this._overlay.add('polygon', {
                points: this._state.tempPoints.slice(),
                options: this._state.options
            });

            result = {
                type: 'polygon',
                id: id,
                points: this._state.tempPoints.slice()
            };
        }

        // 先调用 stop() 清理状态，再触发 complete 事件
        if (result) {
            this._state.status = 'completed';
            this.stop();
            this._events.emit('complete', result);
            this._refresh();
        } else {
            this.stop();
        }
    },

    _getCanvasPos: function(e) {
        var rect = this._canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
};

module.exports = InteractiveDrawer;
