import contourCore from './contour-core.esm.min.mjs'

// 解构获取核心模块
const { computeContours, renderers } = contourCore

/**
 * PlotlContourChart 适配器类
 * 将原 Plotly.js API 映射到 contour_core API
 */
export class PlotlContourChart {
  constructor(container) {
    this.container = container
    this.canvas = null
    this.ctx = null // Canvas 2D 上下文
    this.controller = null
    this.overlay = null
    this.contourResult = null // 等值线计算结果
    this._events = new Map() // 事件系统
    this._currentData = null
    this._colorBarConfig = null
    this._currentStyle = null
    this._currentLayout = null
    this._currentDrawStyle = null
  }

  /**
   * 初始化等值线图
   * @param {object} options 配置选项
   * @param {object} options.data 数据对象 {x: [], y: [], v: [[]], zmin, zmax}
   * @param {object} options.style 样式配置
   * @param {object} options.layout 布局配置
   */
  init(options = {}) {
    const { data = {}, style = {}, layout = {} } = options

    // 验证数据
    if (!data.x || !data.y || !data.v) {
      console.warn('数据格式不正确')
      return
    }

    // 创建 Canvas 元素
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.container.clientWidth
    this.canvas.height = this.container.clientHeight
    this.container.appendChild(this.canvas)

    // 获取 Canvas 2D 上下文
    this.ctx = this.canvas.getContext('2d')

    // 缓存数据
    this._currentData = {
      x: data.x,
      y: data.y,
      z: data.v,
      zmin: data.zmin,
      zmax: data.zmax,
      v: data.v, // 保存原始数据用于重新计算
    }

    // 转换 colorscale 格式
    const valueColorMap = this._convertColorScale(style.colorscale, data.zmin, data.zmax)

    const ncontours = style.colorscale.length
    // 步骤1: 计算等值线
    this.contourResult = computeContours(
      {
        z: data.v,
        x: data.x,
        y: data.y,
      },
      {
        smoothing: 0.5,
        autocontour: true,
        ncontours,
        valueColorMap,
        connectgaps: false,
      },
    )

    // 步骤2: 渲染等值线
    this.controller = renderers.canvas.drawContours(this.ctx, this.contourResult, {
      width: this.canvas.width,
      height: this.canvas.height,
      padding: { top: 10, right: 10, bottom: 70, left: 50 },
      coloring: 'fill+lines',
      showLines: style.showlines !== false,
      lineWidth: 1,
      lineColor: style.lineColor || '#000',
      smoothing: 0.5,
      valueColorMap,
      // aspectRatio: 'equal', // || 'auto',
      // 等值线标注
      showLabels: style.showLabels || false,
      // 简化容差
      simplifyTolerance: style.simplifyTolerance ?? 0.5,
      interaction: {
        zoom: true,
        pan: true,
        dblclickReset: true,
        // Tooltip 悬停功能
        hover: style.enableHover || false,
        hoverHitRadius: 8,
        contourResult: null, // 会在后面设置
        hoverFormatter: style.hoverFormatter || null,
      },
      axes: {
        x: { title: layout.xAxisTitle || 'X轴' },
        y: { title: layout.yAxisTitle || 'Y轴' },
      },
      colorbar: {
        show: false,
      },
    })

    // 获取 overlay 实例
    this.overlay = this.controller.getOverlay()

    // 设置绘制完成事件监听（v0.3.0 事件驱动 API）
    this._setupDrawingEventHandler()

    // 缓存配置
    this._currentStyle = style
    this._currentLayout = layout
  }

  /**
   * 设置绘制完成事件处理器（v0.3.0 事件驱动 API）
   *
   * 注意：文字标签的添加由 _convertXxxStyle 方法中的 text 配置处理，
   * contour_core 的 overlay.startDrawing() 会根据 options.text 自动创建关联的文字标签，
   * 因此这里不需要手动添加文字标签，否则会导致文字被创建两次。
   */
  _setupDrawingEventHandler() {
    if (!this.overlay) return

    this.overlay.on('draw:complete', (result) => {
      console.log('绘制完成事件触发，结果:', result)
      // 处理绘制完成，触发外部事件
      this._handleDrawingComplete(result)

      // 文字标签的添加由 contour_core 根据 options.text 配置自动处理
      // _convertPointStyle/_convertPolylineStyle/_convertPolygonStyle 返回的 options 中已包含 text 配置
      // 这里不再手动添加文字标签，避免重复创建
    })
  }

  /**
   * 转换 colorscale 格式
   * @param {Array} colorscale Plotly 格式 [[pos, color], ...]
   * @param {number} zmin 最小值
   * @param {number} zmax 最大值
   * @returns {Array} contour_core 格式 [[value, color], ...]
   */
  _convertColorScale(colorscale, zmin, zmax) {
    if (!colorscale || colorscale.length === 0) return null

    return colorscale.map(([pos, color]) => {
      const value = zmin + pos * (zmax - zmin)
      return [value, color]
    })
  }

  /**
   * 销毁图表
   */
  dispose() {
    if (this.controller) {
      this.controller.destroy()
      this.controller = null
    }

    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas)
    }

    this.canvas = null
    this.ctx = null
    this.overlay = null
    this.contourResult = null
    this._events.clear()
    this._currentData = null
    this._colorBarConfig = null
  }

  /**
   * 调整图表大小
   */
  resize() {
    if (this.canvas && this.controller) {
      this.canvas.width = this.container.clientWidth
      this.canvas.height = this.container.clientHeight
      this.controller.resize(this.canvas.width, this.canvas.height)
    }
  }

  /**
   * 更新等值线图数据
   * @param {object} newData 新数据对象 {x: [], y: [], z: [[]]}
   */
  updateData(newData) {
    if (!newData || !newData.x || !newData.y || !newData.z) {
      console.warn('更新数据格式不正确')
      return
    }

    this._currentData = {
      x: newData.x,
      y: newData.y,
      z: newData.z,
    }

    this.controller.updateData({
      x: newData.x,
      y: newData.y,
      z: newData.z,
    })
  }

  /**
   * 更新颜色范围
   * @param {Array} colorScale 新的配色数组 [[pos, color], ...]
   * @param {object} contourConfig 等值线配置
   * @param {object} labelConfig 标注配置
   * @param {Array} thresholds 阈值数组
   */
  updateColorScale(colorScale, contourConfig = {}, labelConfig = {}, thresholds = []) {
    const zmin = contourConfig.zmin ?? this._currentData.zmin
    const zmax = contourConfig.zmax ?? this._currentData.zmax

    debugger

    // 转换为 valueColorMap
    const valueColorMap = this._convertColorScale(colorScale, zmin, zmax)

    // 更新颜色（会触发 render）
    this.controller.updateColorScale(valueColorMap)

    // 更新等值线样式（线条显示/隐藏、颜色，标注显示/隐藏、颜色）
    var styleUpdates = {}
    if (contourConfig.showLines !== undefined) {
      styleUpdates.showLines = contourConfig.showLines
      this._currentStyle.showlines = contourConfig.showLines
    }
    if (contourConfig.color !== undefined) {
      styleUpdates.lineColor = contourConfig.color
      this._currentStyle.lineColor = contourConfig.color
    }

    if(contourConfig.lineType !== undefined) {
      styleUpdates.lineType = contourConfig.lineType
      this._currentStyle.lineType = contourConfig.lineType
    }

    if (labelConfig.showLabels !== undefined) {
      styleUpdates.showLabels = labelConfig.showLabels
      this._currentStyle.showLabels = labelConfig.showLabels
    }
    if (labelConfig.color !== undefined) {
      styleUpdates.labelColor = labelConfig.color
      this._currentStyle.labelColor = labelConfig.color
    }
    if (Object.keys(styleUpdates).length > 0) {
      this.controller.updateStyle(styleUpdates)
    }

    // 更新缓存中的色阶
    this._currentStyle.colorscale = colorScale
  }

  /**
   * 获取当前等值线图的值域范围
   * @returns {object} 值域范围对象 {zmin, zmax}
   */
  getValueRange() {
    return {
      zmin: this._currentData?.zmin ?? null,
      zmax: this._currentData?.zmax ?? null,
    }
  }

  /**
   * 切换显示模式
   * @param {string} mode 显示模式 ('fill' 或 'heatmap')
   */
  changeShowMode(mode) {
    this.controller.updateContours({
      contours: {
        type: mode === 'fill' ? 'fill' : 'heatmap',
      },
    })
  }

  /**
   * 更新等值线渲染设置
   * @param {object} options 配置选项
   * @param {boolean} options.showLabels 显示等值线标注
   * @param {boolean} options.enableHover 显示等值线 Tooltip
   * @param {number} options.simplifyTolerance 简化容差
   */
  updateContourSettings(options = {}) {
    const { showLabels, enableHover, simplifyTolerance } = options

    // 更新样式缓存
    if (showLabels !== undefined) this._currentStyle.showLabels = showLabels
    if (enableHover !== undefined) this._currentStyle.enableHover = enableHover
    if (simplifyTolerance !== undefined) this._currentStyle.simplifyTolerance = simplifyTolerance

    // 重新渲染等值线
    if (this.controller && this.contourResult && this.ctx) {
      // 保存当前的 overlay shapes 数据
      const savedShapes = this._savedShapes || []
      const savedColorBarConfig = this._colorBarConfig

      // 获取当前的颜色映射
      const valueColorMap = this._convertColorScale(
        this._currentStyle?.colorscale,
        this._currentData?.zmin,
        this._currentData?.zmax,
      )

      // 销毁旧的 controller
      if (this.controller.destroy) {
        this.controller.destroy()
      }

      // 清空画布
      this.ctx.fillStyle = this._currentStyle.backgroundColor || '#ffffff'
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

      // 重新渲染
      this.controller = renderers.canvas.drawContours(this.ctx, this.contourResult, {
        width: this.canvas.width,
        height: this.canvas.height,
        padding: { top: 10, right: 10, bottom: 70, left: 50 },
        coloring: 'fill+lines',
        showLines: this._currentStyle.showlines !== false,
        lineWidth: 1,
        lineColor: this._currentStyle.lineColor || '#000',
        smoothing: 0.5,
        valueColorMap,
        // 等值线标注
        showLabels: this._currentStyle.showLabels || false,
        // 简化容差
        simplifyTolerance: this._currentStyle.simplifyTolerance ?? 0.5,
        interaction: {
          zoom: true,
          pan: true,
          dblclickReset: true,
          // Tooltip 悬停功能
          hover: this._currentStyle.enableHover || false,
          hoverHitRadius: 8,
          contourResult: this.contourResult,
          hoverFormatter: this._currentStyle.hoverFormatter || null,
        },
        axes: {
          x: { title: this._currentLayout?.xAxisTitle || 'X轴' },
          y: { title: this._currentLayout?.yAxisTitle || 'Y轴' },
        },
        colorbar: {
          show: false,
        },
      })

      // 重新获取 overlay 实例
      this.overlay = this.controller.getOverlay()

      // 重新设置绘制事件监听
      this._setupDrawingEventHandler()

      // 恢复之前保存的 shapes
      if (savedShapes.length > 0) {
        savedShapes.forEach((shapeData) => {
          this.initShape(shapeData)
        })
      }

      // 恢复 colorbar
      if (savedColorBarConfig) {
        this.addD3ColorBar(savedColorBarConfig.colorBars, savedColorBarConfig.options)
      }
    }
  }

  /**
   * 保存 shape 数据（用于重新渲染时恢复）
   * @param {object} shapeData 图形数据
   */
  saveShape(shapeData) {
    if (!this._savedShapes) {
      this._savedShapes = []
    }
    // 检查是否已存在，如果存在则更新
    const existingIndex = this._savedShapes.findIndex((s) => s.id === shapeData.id)
    if (existingIndex >= 0) {
      this._savedShapes[existingIndex] = shapeData
    } else {
      this._savedShapes.push(shapeData)
    }
  }

  /**
   * 删除保存的 shape 数据
   * @param {string} shapeId 图形ID
   */
  removeSavedShape(shapeId) {
    if (this._savedShapes) {
      this._savedShapes = this._savedShapes.filter((s) => s.id !== shapeId)
    }
  }

  /**
   * 使用 contour_core 内置颜色条 (离散/稀疏模式)
   * @param {Array} colorBars 颜色条配置 [[level, color], ...]
   * @param {object} options 配置选项
   * @param {string} options.position 位置 ('right' | 'left' | 'top' | 'bottom')，默认 'right'
   * @param {number} options.width 厚度，默认 30
   * @param {number} options.padding 内边距，默认 10
   * @param {number} options.tickInterval 标注间隔，默认 0 (自动)
   * @param {boolean} options.showLabels 显示标注，默认 true
   * @param {string} options.labelColor 标注颜色，默认 '#000'
   * @param {number} options.labelSize 标注大小，默认 12
   * @param {string} options.fontFamily 字体，默认 'Arial'
   * @param {string} options.title 标题，默认 ''
   * @param {boolean} options.horizontal 是否水平 (已废弃，请使用 position: 'bottom' 或 'top')
   */
  addD3ColorBar(colorBars, options = {}) {
    const {
      width = 30,
      rightMargin = 20,
      topMargin = 50,
      bottomMargin = 50,
      labelColor = '#000',
      labelSize = 12,
      fontFamily = 'Arial',
      horizontal = false,
      showLabels = true,
      title = '',
      tickInterval = 0,
      // 新增 position 选项，支持 'right' | 'left' | 'top' | 'bottom'
      position = null,
      padding = 10,
    } = options

    // 移除已存在的 colorbar
    this.removeD3ColorBar()

    // 确定最终位置：优先使用 position，否则根据 horizontal 推断
    const finalPosition = position || (horizontal ? 'bottom' : 'right')

    // 缓存配置
    this._colorBarConfig = {
      colorBars,
      options: {
        width,
        rightMargin,
        topMargin,
        bottomMargin,
        labelColor,
        labelSize,
        fontFamily,
        horizontal,
        showLabels,
        title,
        tickInterval,
        position: finalPosition,
        padding,
      },
    }

    // 转换 colorBars 格式为 [value, color] (离散 colorbar 需要的格式)
    // colorBars 格式: [[level, color], ...] -> blocks 格式: [[value, color], ...]
    const blocks = colorBars.map((bar) => {
      const value = Number.parseFloat(bar[0])
      const color = bar[1]
      return [value, color]
    })

    // 使用 contour_core 的离散 colorbar (通过 blocks 配置)
    if (this.controller) {
      this.controller.updateColorbar({
        show: true,
        // 离散 colorbar 配置
        blocks,
        position: finalPosition,
        thickness: width,
        padding,
        tickInterval,
        title: title || '',
        showLabels,
        labelColor,
        labelSize,
        fontFamily,
      })
    }
  }

  /**
   * 更新颜色条
   * @param {Array} colorBars 颜色条配置
   * @param {object} options 配置选项
   */
  updateD3ColorBar(colorBars, options = {}) {
    // 保留之前的 colorbar 配置（位置、宽度等），新 options 覆盖对应字段
    var prevOptions = (this._colorBarConfig && this._colorBarConfig.options) || {}
    var mergedOptions = {}
    var key
    for (key in prevOptions) mergedOptions[key] = prevOptions[key]
    for (key in options) mergedOptions[key] = options[key]
    this.addD3ColorBar(colorBars, mergedOptions)
  }

  /**
   * 移除颜色条
   */
  removeD3ColorBar() {
    if (this.controller) {
      this.controller.updateColorbar({ show: false })
    }
    this._colorBarConfig = null
  }

  /**
   * 初始化已有的图形
   * @param {object} shapeData 图形数据
   */
  initShape(shapeData) {
    const {
      id,
      type,
      name,
      createTime,
      note = '',
      status = 'active',
      style = {},
      points = [],
    } = shapeData

    // 验证必要参数
    if (!id || !type || !points || points.length === 0) {
      console.warn('图形数据格式不正确')
      return
    }

    // 保存 shape 数据用于重新渲染时恢复
    this.saveShape(shapeData)

    // 根据类型调用对应的 overlay 方法
    switch (type) {
      case 'point':
        this._initPointShape(id, points, style)
        break
      case 'polyline':
        this._initPolylineShape(id, points, style)
        break
      case 'polygon':
        this._initPolygonShape(id, points, style)
        break
      case 'text':
        this._initTextShape(id, points, style)
        break
      default:
        console.warn(`不支持的图形类型: ${type}`)
    }
  }

  /**
   * 初始化点图形
   * @param {string} id 图形ID
   * @param {Array} points 点坐标数组
   * @param {object} style 样式配置
   */
  _initPointShape(id, points, style) {
    if (points.length === 0) return

    const point = points[0]
    const options = this._convertPointStyle(style)
    this.overlay.drawPoint(point.x, point.y, { id, ...options })
  }

  /**
   * 初始化折线图形
   * @param {string} id 图形ID
   * @param {Array} points 点坐标数组
   * @param {object} style 样式配置
   */
  _initPolylineShape(id, points, style) {
    const convertedPoints = points.map((p) => ({ x: p.x, y: p.y }))
    const options = this._convertPolylineStyle(style)

    this.overlay.drawLine(convertedPoints, { id, ...options })
  }

  /**
   * 初始化多边形图形
   * @param {string} id 图形ID
   * @param {Array} points 点坐标数组
   * @param {object} style 样式配置
   */
  _initPolygonShape(id, points, style) {
    const convertedPoints = points.map((p) => ({ x: p.x, y: p.y }))
    const options = this._convertPolygonStyle(style)

    this.overlay.drawPolygon(convertedPoints, { id, ...options })
  }

  /**
   * 初始化文字图形
   * @param {string} id 图形ID
   * @param {Array} points 点坐标数组
   * @param {object} style 样式配置
   */
  _initTextShape(id, points, style) {
    if (points.length === 0) return

    const point = points[0]
    const options = this._convertTextStyle(style)
    // 从转换后的 options 中获取文字内容
    const content = options.content || ''

    this.overlay.drawText(point.x, point.y, content, { id, ...options })
  }

  /**
   * 转换点样式
   * 将 assembleLegendData 返回的格式转换为 contour_core overlay API 格式
   * @param {object} style 原始样式 (来自 assembleLegendData)
   * @returns {object} contour_core overlay API 格式
   */
  _convertPointStyle(style) {
    // 映射点形状: assembleLegendData 使用的名称 -> contour_core 支持的形状
    const shapeMap = {
      circle: 'circle',
      square: 'square',
      triangle: 'triangle',
      diamond: 'diamond',
      star: 'star',
      // 兼容中文名称
      圆形: 'circle',
      方形: 'square',
      三角形: 'triangle',
      菱形: 'diamond',
      星形: 'star',
    }

    return {
      color: style.color || '#ff0000',
      size: style.size || 10,
      shape: shapeMap[style.symbol] || style.symbol || 'circle',
      opacity: style.opacity ?? 1,
      strokeColor: style.strokeColor || null,
      strokeWidth: style.strokeWidth || 0,
      // 保存文字配置，用于绘制完成后添加标签
      text: style.text || null,
    }
  }

  /**
   * 转换折线样式
   * 将 assembleLegendData 返回的格式转换为 contour_core overlay API 格式
   * @param {object} style 原始样式 (来自 assembleLegendData)
   * @returns {object} contour_core overlay API 格式
   */
  _convertPolylineStyle(style) {
    // 映射线型: assembleLegendData 使用的名称 -> contour_core 支持的样式
    const styleMap = {
      solid: 'solid',
      dashed: 'dashed',
      dotted: 'dotted',
      dash: 'dashed', // 兼容
      // 兼容中文名称
      实线: 'solid',
      虚线: 'dashed',
      点线: 'dotted',
    }

    // assembleLegendData 返回的 type 字段表示线型
    const lineStyle = styleMap[style.type] || style.type || 'solid'

    return {
      color: style.color || '#000000',
      width: style.width || 2,
      style: lineStyle,
      opacity: style.opacity ?? 1,
      // 保存文字配置，用于绘制完成后添加标签
      text: style.text || null,
    }
  }

  /**
   * 转换多边形样式
   * 将 assembleLegendData 返回的格式转换为 contour_core overlay API 格式
   * @param {object} style 原始样式 (来自 assembleLegendData)
   * @returns {object} contour_core overlay API 格式
   */
  _convertPolygonStyle(style) {
    const lineStyle = style.lineStyle || {}
    const fillStyle = style.fillStyle || {}

    // 映射填充图案类型
    // SURFACE_FILLS: '/': 斜线, '+': 正交网格, '.': 圆点阵列, '': 颜色填充
    const patternMap = {
      '': 'solid',
      'none': 'solid',
      'solid': 'solid',
      'grid': 'grid',
      'diagonal': 'diagonal',
      'dots': 'dots',
      'hash': 'hash',
      // SURFACE_FILLS 中的符号映射
      '/': 'diagonal', // 斜线
      '+': 'grid', // 正交网格
      '.': 'dots', // 圆点阵列
      // 兼容中文名称
      '网格': 'grid',
      '斜线': 'diagonal',
      '圆点': 'dots',
      '无': 'solid',
      '正交网格': 'grid',
      '圆点阵列': 'dots',
      '颜色填充': 'solid',
    }

    // 映射线型
    const lineStyleMap = {
      solid: 'solid',
      dashed: 'dashed',
      dotted: 'dotted',
      dash: 'dashed',
      // 兼容中文名称
      实线: 'solid',
      虚线: 'dashed',
      点线: 'dotted',
    }

    // 根据 fillStyle.type 决定填充方式
    const hasPattern = fillStyle.type === 'pattern' && fillStyle.pattern
    const patternType = patternMap[fillStyle.pattern] || 'solid'

    // 获取填充颜色 - 优先使用 color，其次 bgcolor
    const fillColor = fillStyle.color || fillStyle.bgcolor || 'rgba(0,255,0,0.3)'

    // 构建填充配置
    let fill
    if (hasPattern && patternType !== 'solid') {
      // 图案填充
      fill = {
        type: 'pattern',
        pattern: patternType,
        patternColor: lineStyle.color || '#333333',
        patternSize: 12,
        color: fillColor, // 背景色
      }
    } else {
      // 纯色填充
      fill = {
        color: fillColor,
      }
    }

    return {
      fill,
      stroke: {
        color: lineStyle.color || '#333333',
        width: lineStyle.width || 2,
        style: lineStyleMap[lineStyle.type] || lineStyle.type || 'solid',
      },
      opacity: fillStyle.opacity ?? 0.6,
      // 保存文字配置，用于绘制完成后添加标签
      text: style.text || null,
    }
  }

  /**
   * 转换文字样式
   * 将 assembleLegendData 返回的 text 格式转换为 contour_core overlay API 格式
   * @param {object} style 原始样式 (来自 assembleLegendData)
   * @returns {object} contour_core overlay API 格式
   *
   * assembleLegendData(markType=4) 返回格式:
   * {
   *   text: { content, color, size, fontFamily, opacity, show },
   *   background: ...
   * }
   *
   * contour_core overlay.drawText 需要的格式:
   * {
   *   color, fontSize, fontFamily, fontWeight, opacity, content, background
   * }
   */
  _convertTextStyle(style) {
    // 处理 assembleLegendData 返回的嵌套格式
    // style.text 可能是对象 { content, color, size, fontFamily, ... }
    // 也可能是字符串（在某些情况下）
    let textStyle = {}
    let content = ''
    let background = null

    if (style.text && typeof style.text === 'object') {
      // assembleLegendData 返回的格式: { text: { content, color, size, ... }, background }
      textStyle = style.text
      content = textStyle.content || ''
      background = style.background || null
    } else if (style.text && typeof style.text === 'string') {
      // 直接传入文字内容的情况（如 updateShapeStyle 传入 { text, color, size, font, opacity }）
      content = style.text
      textStyle = style
      background = style.background || null
    } else if (style.content) {
      // 直接有 content 属性
      content = style.content
      textStyle = style
      background = style.background || null
    } else {
      // 兜底：使用整个 style 作为 textStyle
      textStyle = style
      content = style.content || ''
      background = style.background || null
    }

    return {
      color: textStyle.color || '#000000',
      fontSize: textStyle.size || 14,
      fontFamily: textStyle.fontFamily || 'Arial',
      fontWeight: textStyle.fontWeight || 'normal',
      opacity: textStyle.opacity ?? 1,
      // 文字内容 - 同时设置 text 和 content 属性，确保兼容性
      text: content,
      content,
      // 背景色
      background,
    }
  }

  /**
   * 删除图形
   * @param {string} shapeId 图形ID
   * @returns {boolean} 是否删除成功
   */
  deleteShapeById(shapeId) {
    // 从保存的 shapes 中移除
    this.removeSavedShape(shapeId)
    // 从 overlay 中移除
    return this.overlay.removeItem(shapeId)
  }

  /**
   * 定位图形
   * @param {string} shapeId 图形ID
   * @param {object} options 定位选项
   * @returns {boolean} 是否定位成功
   */
  locateShapeById(shapeId, options = {}) {
    const { padding = 0.1 } = options
    // this.overlay.focusTo(shapeId, { padding })
    return this.overlay.focusTo(shapeId, { padding })
  }

  // 高亮显示`
  highlightShapeById(shapeId, options = {}) {
    return this.overlay.highlight(shapeId, options)
    //  overlay.highlight(selectedId, { color: color, duration: duration });
  }

  /**
   * 更新图形样式
   * @param {string} shapeId 图形ID
   * @param {string} type 图形类型
   * @param {object} newStyle 新的样式配置
   * @returns {boolean} 是否更新成功
   */
  updateShapeStyle(shapeId, type, newStyle = {}) {
    let convertedStyle = {}

    switch (type) {
      case 'point':
        convertedStyle = this._convertPointStyle(newStyle)
        break
      case 'polyline':
        convertedStyle = this._convertPolylineStyle(newStyle)
        break
      case 'polygon':
        convertedStyle = this._convertPolygonStyle(newStyle)
        break
      case 'text':
        convertedStyle = this._convertTextStyle(newStyle)
        break
    }
    return this.overlay.updateStyle(shapeId, convertedStyle)
  }

  /**
   * 设置图形可见性
   * @param {object} options 可见性配置
   */
  setShapesVisibility(options = {}) {
    const {
      showPolyline = true,
      showPolygon = true,
      showPoint = true,
      showText = true,
    } = options

    if (!showPolyline) {
      this.overlay.hideByType('line')
    } else {
      this.overlay.showByType('line')
    }

    if (!showPolygon) {
      this.overlay.hideByType('polygon')
    } else {
      this.overlay.showByType('polygon')
    }

    if (!showPoint) {
      this.overlay.hideByType('point')
    } else {
      this.overlay.showByType('point')
    }

    if (!showText) {
      this.overlay.hideByType('text')
    } else {
      this.overlay.showByType('text')
    }
  }

  /**
   * 处理绘制完成回调
   * @param {object} result 绘制结果
   *
   * contour_core 返回格式:
   * - point: { type: 'point', id, position: { x, y } }
   * - text: { type: 'text', id, position: { x, y }, content, options }
   * - line: { type: 'line', id, points: [[x,y],...] }
   * - polygon: { type: 'polygon', id, points: [[x,y],...] }
   *
   * 标准化输出格式:
   * { id, type, points: [{x,y},...], content?, options? }
   */
  _handleDrawingComplete(result) {
    let points = []

    if (result.type === 'point') {
      // 点类型
      const pos = result.position || result
      points = [{ x: pos.x, y: pos.y }]
    } else if (result.type === 'text') {
      // 文字类型：需要保留 content 和 options
      const pos = result.position || result
      points = [{ x: pos.x, y: pos.y }]
    } else if (result.points) {
      // 线或面类型
      points = result.points.map((p) => {
        if (Array.isArray(p)) {
          return { x: p[0], y: p[1] }
        }
        return { x: p.x, y: p.y }
      })
    }

    // 转换数据格式 - 文字类型需要额外包含 content 和 options
    const normalizedData = {
      id: result.id,
      type: result.type,
      points,
    }

    // 文字类型特殊处理：保留 content 和样式选项
    if (result.type === 'text') {
      if (result.content !== undefined) {
        normalizedData.content = result.content
      }
      if (result.options) {
        normalizedData.options = result.options
      }
    }

    console.log('绘制完成，标准化数据:', normalizedData)

    // 触发事件
    this.emit('drawingComplete', normalizedData)
  }

  /**
   * 计算质心
   * @param {Array} points 点数组
   * @returns {object} 质心坐标
   */
  _calculateCentroid(points) {
    if (!points || points.length === 0) {
      return { x: 0, y: 0 }
    }

    const sumX = points.reduce((sum, p) => sum + (Array.isArray(p) ? p[0] : p.x), 0)
    const sumY = points.reduce((sum, p) => sum + (Array.isArray(p) ? p[1] : p.y), 0)

    return {
      x: sumX / points.length,
      y: sumY / points.length,
    }
  }

  /**
   * 开始绘制点
   * @param {object} style 样式配置
   */
  startDrawPoint(style = {}) {
    const options = this._convertPointStyle(style)

    // 保存样式用于绘制完成后的文字标签处理
    this._currentDrawStyle = style

    // v0.3.0 事件驱动 API：不再传递回调，通过 overlay.on('draw:complete') 处理
    this.overlay.startDrawing('point', options, this.canvas)
  }

  /**
   * 开始绘制折线
   * @param {object} style 样式配置
   */
  startDrawPolyline(style = {}) {
    const options = this._convertPolylineStyle(style)

    // 保存样式用于绘制完成后的文字标签处理
    this._currentDrawStyle = style

    // v0.3.0 事件驱动 API：不再传递回调，通过 overlay.on('draw:complete') 处理
    this.overlay.startDrawing('line', options, this.canvas)
  }

  /**
   * 开始绘制多边形
   * @param {object} style 样式配置
   */
  startDrawPolygon(style = {}) {
    const options = this._convertPolygonStyle(style)

    // 保存样式用于绘制完成后的文字标签处理
    this._currentDrawStyle = style

    // v0.3.0 事件驱动 API：不再传递回调，通过 overlay.on('draw:complete') 处理
    this.overlay.startDrawing('polygon', options, this.canvas)
    // console.log('开始绘制多边形，ID:', id)
  }

  /**
   * 开始绘制文字
   * @param {object} style 样式配置
   */
  startDrawText(style = {}) {
    const options = this._convertTextStyle(style)

    // 保存样式（虽然文字类型不需要额外处理）
    this._currentDrawStyle = style

    // v0.3.0 事件驱动 API：不再传递回调，通过 overlay.on('draw:complete') 处理
    this.overlay.startDrawing('text', options, this.canvas)
  }

  /**
   * 添加事件监听器
   * @param {string} eventName 事件名称
   * @param {Function} callback 回调函数
   */
  on(eventName, callback) {
    if (!this._events.has(eventName)) {
      this._events.set(eventName, new Set())
    }
    this._events.get(eventName).add(callback)
  }

  /**
   * 移除事件监听器
   * @param {string} eventName 事件名称
   * @param {Function} callback 回调函数
   */
  off(eventName, callback) {
    if (this._events.has(eventName)) {
      this._events.get(eventName).delete(callback)
    }
  }

  /**
   * 触发事件
   * @param {string} eventName 事件名称
   * @param {any} data 事件数据
   */
  emit(eventName, data) {
    if (this._events.has(eventName)) {
      this._events.get(eventName).forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in event handler for ${eventName}:`, error)
        }
      })
    }
  }
}
