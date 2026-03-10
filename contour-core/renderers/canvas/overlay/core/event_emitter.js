'use strict';

/**
 * EventEmitter - 简单的事件发射器
 * 用于组件间解耦通信
 */
function EventEmitter() {
    this._events = {};
}

EventEmitter.prototype = {
    /**
     * 订阅事件
     * @param {string} event - 事件名称
     * @param {Function} handler - 处理函数
     */
    on: function(event, handler) {
        if (!this._events[event]) {
            this._events[event] = [];
        }
        this._events[event].push(handler);
        return this;
    },

    /**
     * 取消订阅
     * @param {string} event - 事件名称
     * @param {Function} handler - 处理函数
     */
    off: function(event, handler) {
        if (!this._events[event]) return this;

        if (handler) {
            this._events[event] = this._events[event].filter(function(h) {
                return h !== handler;
            });
        } else {
            delete this._events[event];
        }
        return this;
    },

    /**
     * 订阅一次
     * @param {string} event - 事件名称
     * @param {Function} handler - 处理函数
     */
    once: function(event, handler) {
        var self = this;
        var wrapper = function(data) {
            handler(data);
            self.off(event, wrapper);
        };
        return this.on(event, wrapper);
    },

    /**
     * 发射事件
     * @param {string} event - 事件名称
     * @param {*} data - 事件数据
     */
    emit: function(event, data) {
        if (!this._events[event]) return this;

        var handlers = this._events[event].slice();
        for (var i = 0; i < handlers.length; i++) {
            handlers[i](data);
        }
        return this;
    },

    /**
     * 清除所有事件
     */
    clear: function() {
        this._events = {};
    }
};

module.exports = EventEmitter;
