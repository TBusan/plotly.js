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
     * @param {string} [data.id] - 可选的自定义ID，如果不传或已存在则自动生成
     * @returns {string} 元素ID
     */
    add: function(type, data) {
        // 如果传入了 id 且不冲突，使用传入的 id；否则自动生成
        var customId = data && data.id;
        var id = (customId && !this._items.has(customId))
            ? customId
            : this._generateId();

        var item = Object.assign({ id: id, type: type }, data);
        // 确保使用最终确定的 id（防止 data.id 被覆盖）
        item.id = id;
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
     * 更新元素的ID
     * @param {string} oldId - 旧ID
     * @param {string} newId - 新ID
     * @returns {Object|null} 更新后的元素，失败返回 null
     */
    updateId: function(oldId, newId) {
        // 检查旧ID是否存在
        var item = this._items.get(oldId);
        if (!item) {
            return null;
        }

        // 检查新ID是否有效
        if (!newId || typeof newId !== 'string') {
            return null;
        }

        // 检查新ID是否已被使用
        if (this._items.has(newId)) {
            return null;
        }

        // 如果新ID和旧ID相同，直接返回
        if (oldId === newId) {
            return item;
        }

        // 从旧位置删除
        this._items.delete(oldId);

        // 更新类型索引
        if (this._indices[item.type]) {
            this._indices[item.type].delete(oldId);
            this._indices[item.type].add(newId);
        }

        // 更新隐藏状态
        if (this._hidden.has(oldId)) {
            this._hidden.delete(oldId);
            this._hidden.add(newId);
        }

        // 更新元素ID
        item.id = newId;

        // 添加到新位置
        this._items.set(newId, item);

        return item;
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
        // Map.prototype.values() returns an iterator, not an array — wrap it
        // in Array.from before .filter (TypeError otherwise).
        return Array.from(this._items.values()).filter(function(item) {
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
