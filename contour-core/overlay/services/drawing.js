'use strict';

var lineRenderer = require('../primitives/line');
var pointRenderer = require('../primitives/point');
var polygonRenderer = require('../primitives/polygon');
var textRenderer = require('../primitives/text');

/**
 * OverlayRenderer - 渲染服务
 * 职责：将 Overlay 数据渲染到 Canvas
 */
function OverlayRenderer(coordSystem) {
    this._coordSystem = coordSystem;
}

OverlayRenderer.prototype = {
    /**
     * 渲染所有元素（应用裁剪)
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {Overlay} overlay - 数据容器
     * @param {Object} drawingArea - 绘制区域 {x, y, width, height}
     */
    render: function(ctx, overlay, drawingArea) {
        var self = this;
        ctx.save();

        // 应用裁剪区域
        if (drawingArea) {
            ctx.beginPath();
            ctx.rect(drawingArea.x, drawingArea.y, drawingArea.width, drawingArea.height);
            ctx.clip();
        }

        // 过滤隐藏元素的辅助函数
        function filterVisible(items) {
            return items.filter(function(item) {
                return !overlay.isHidden(item.id);
            });
        }

        // 按顺序渲染：面 → 线 → 点 → 文字（跳过隐藏元素）
        polygonRenderer.render(ctx, filterVisible(overlay.getByType('polygon')), self._coordSystem);
        lineRenderer.render(ctx, filterVisible(overlay.getByType('line')), self._coordSystem);
        pointRenderer.render(ctx, filterVisible(overlay.getByType('point')), self._coordSystem);
        textRenderer.render(ctx, filterVisible(overlay.getByType('text')), self._coordSystem);

        ctx.restore();
    },

    /**
     * 渲染临时状态（绘制过程中的预览）
     * @param {CanvasRenderingContext2D} ctx - 画布上下文
     * @param {Object} drawState - InteractiveDrawer 的状态
     */
    renderTemp: function(ctx, drawState) {
        if (!drawState || !drawState.mode || drawState.points.length === 0) {
            return;
        }

        var self = this;
        var points = drawState.points.slice();
        if (drawState.mousePos) {
            points.push([drawState.mousePos.x, drawState.mousePos.y]);
        }

        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = drawState.options.color || '#0066ff';
        ctx.lineWidth = drawState.options.width || 2;

        // 转换坐标
        var canvasPoints = points.map(function(p) {
            return self._coordSystem.toCanvas(p[0], p[1]);
        }).filter(function(p) {
            return p !== null;
        });

        if (canvasPoints.length >= 2) {
            ctx.beginPath();
            ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
            for (var i = 1; i < canvasPoints.length; i++) {
                ctx.lineTo(canvasPoints[i].x, canvasPoints[i].y);
            }

            if (drawState.mode === 'polygon' && canvasPoints.length >= 3) {
                ctx.closePath();
                var fillColor = drawState.options.fill && drawState.options.fill.color;
                ctx.fillStyle = fillColor || 'rgba(0,100,255,0.2)';
                ctx.fill();
            }

            ctx.stroke();
        }

        // 绘制顶点标记
        canvasPoints.forEach(function(p) {
            ctx.beginPath();
            ctx.setLineDash([]);
            ctx.fillStyle = '#0066ff';
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.restore();
    }
};

module.exports = OverlayRenderer;
