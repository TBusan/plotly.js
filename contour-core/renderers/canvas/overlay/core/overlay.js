'use strict';

/**
 * Overlay - 纯数据容器
 * 职责：存储、查询、删除覆盖物数据
 * 不包含任何绘制逻辑！
 */
function Overlay() {
    this._items = new Map();  // id → item
    this._hidden = new Set(); // 存储隐藏的元素ID
    this._indices = {
        text: new Set(),
        point: new Set(),
        line: new Set(),
        polygon: new Set()
    };
    this._idCounter = 0;
}

Overlay.prototype = {
    // ========================================
    // 增删改查 (CRUD)
    // ========================================

    /**
     * 添加一个元素
     * @param {string} type - 元素类型 ('text', 'point', 'line', 'polygon')
     * @param {Object} data - 元素数据
     * @returns {string} 元素ID
     */
    add: function(type, data) {
        var id = this._generateId();
        var item = Object.assign({ id: id, type: type }, data);
        this._items.set(id, item);
        if (this._indices[type]) {
            this._indices[type].add(id);
        }
        return id;
    },

    /**
     * 获取单个元素
     * @param {string} id - 元素ID
     * @returns {Object|null} 元素数据
     */
    get: function(id) {
        return this._items.get(id) || null;
    },

    /**
     * 获取某类型的所有元素
     * @param {string} type - 元素类型
     * @returns {Array} 元素数组
     */
    getByType: function(type) {
        var self = this;
        if (!this._indices[type]) return [];
        return Array.from(this._indices[type]).map(function(id) {
            return self._items.get(id);
        }).filter(function(item) {
            return item !== undefined;
        });
    },

    /**
     * 获取所有元素
     * @returns {Array} 所有元素数组
     */
    getAll: function() {
        return Array.from(this._items.values());
    },

    /**
     * 更新元素
     * @param {string} id - 元素ID
     * @param {Object} data - 更新数据
     * @returns {Object|null} 更新后的元素
     */
    update: function(id, data) {
        var item = this._items.get(id);
        if (item) {
            Object.assign(item, data);
        }
        return item || null;
    },

    /**
     * 删除元素
     * @param {string} id - 元素ID
     * @returns {boolean} 是否删除成功
     */
    remove: function(id) {
        var item = this._items.get(id);
        if (item) {
            this._items.delete(id);
            if (this._indices[item.type]) {
                this._indices[item.type].delete(id);
            }
            return true;
        }
        return false;
    },

    /**
     * 清空某类型或所有元素
     * @param {string} [type] - 元素类型，不传则清空所有
     */
    clear: function(type) {
        var self = this;
        if (type) {
            if (this._indices[type]) {
                this._indices[type].forEach(function(id) {
                    self._items.delete(id);
                });
                this._indices[type].clear();
            }
        } else {
            this._items.clear();
            Object.keys(this._indices).forEach(function(key) {
                self._indices[key].clear();
            });
        }
    },

    /**
     * 获取元素数量
     * @param {string} [type] - 元素类型，不传则返回总数
     * @returns {number} 元素数量
     */
    count: function(type) {
        if (type) {
            return this._indices[type] ? this._indices[type].size : 0;
        }
        return this._items.size;
    },

    // ========================================
    // 显示/隐藏
    // ========================================

    /**
     * 隐藏元素
     * @param {string} id - 元素ID
     * @returns {boolean} 是否成功隐藏
     */
    hide: function(id) {
        if (this._items.has(id)) {
            this._hidden.add(id);
            return true;
        }
        return false;
    },

    /**
     * 显示元素
     * @param {string} id - 元素ID
     * @returns {boolean} 是否成功显示
     */
    show: function(id) {
        if (this._hidden.has(id)) {
            this._hidden.delete(id);
            return true;
        }
        return false;
    },

    /**
     * 切换元素的显示/隐藏状态
     * @param {string} id - 元素ID
     * @returns {boolean} 切换后的状态 (true=隐藏, false=显示)
     */
    toggle: function(id) {
        if (this._hidden.has(id)) {
            this._hidden.delete(id);
            return false;
        } else if (this._items.has(id)) {
            this._hidden.add(id);
            return true;
        }
        return false;
    },

    /**
     * 检查元素是否隐藏
     * @param {string} id - 元素ID
     * @returns {boolean} 是否隐藏
     */
    isHidden: function(id) {
        return this._hidden.has(id);
    },

    /**
     * 隐藏所有元素
     */
    hideAll: function() {
        var self = this;
        this._items.forEach(function(_, id) {
            self._hidden.add(id);
        });
    },

    /**
     * 显示所有元素
     */
    showAll: function() {
        this._hidden.clear();
    },

    /**
     * 隐藏某类型的所有元素
     * @param {string} type - 元素类型
     */
    hideByType: function(type) {
        var self = this;
        if (this._indices[type]) {
            this._indices[type].forEach(function(id) {
                self._hidden.add(id);
            });
        }
    },

    /**
     * 显示某类型的所有元素
     * @param {string} type - 元素类型
     */
    showByType: function(type) {
        var self = this;
        if (this._indices[type]) {
            this._indices[type].forEach(function(id) {
                self._hidden.delete(id);
            });
        }
    },

    /**
     * 获取所有可见元素
     * @returns {Array} 可见元素数组
     */
    getVisible: function() {
        var self = this;
        return this._items.values().filter(function(item) {
            return !self._hidden.has(item.id);
        });
    },

    /**
     * 获取所有隐藏元素
     * @returns {Array} 隐藏元素数组
     */
    getHidden: function() {
        var self = this;
        return Array.from(this._hidden).map(function(id) {
            return self._items.get(id);
        }).filter(function(item) {
            return item !== undefined;
        });
    },

    // ========================================
    // 内部方法
    // ========================================

    _generateId: function() {
        var timestamp = Date.now().toString(36);
        var random = Math.random().toString(36).substring(2, 8);
        return 'overlay_' + timestamp + '_' + random + '_' + (++this._idCounter);
    }
};

module.exports = Overlay;
